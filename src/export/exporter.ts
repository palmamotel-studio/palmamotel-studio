import { writePsd } from "ag-psd";
import { zipSync } from "fflate";
import type { Projet } from "../etat/projet";
import type { Taille, Vue } from "../moteur/types";
import { NOMS_VUES } from "../moteur/types";
import { rendreProjet } from "../etat/calcul";
import { svgDe, type Rendu } from "../moteur/rendu";
import { details } from "../moteur/details";
import { pxParMm } from "../moteur/echelle";
import { ficheTechnique } from "./fiche";
import { mmEnPx, calquesProcreateEstimes, PROCREATE } from "../moteur/echelle";
import { versBlob } from "./raster";
import { calqueCanvas, compositeCanvas } from "./canvas";
import { precharger } from "../etat/visuels";

export type Format = "psd" | "png" | "png_calques" | "svg" | "json" | "deplacement" | "details" | "pdf";
export type Prereglage = "procreate" | "canva" | "impression" | "reseaux";

export const PREREGLAGES: Record<Prereglage, { nom: string; aide: string; dpi: number; formats: Format[] }> = {
  procreate: { nom: "Procreate (iPad)", aide: "PSD en calques à l'échelle réelle, prêt à ouvrir dans Procreate. 150 DPI garde assez de calques disponibles sur iPad.", dpi: 150, formats: ["psd"] },
  canva: { nom: "Canva", aide: "PNG transparent + un PNG par calque (Canva ne gère pas les calques).", dpi: 150, formats: ["png", "png_calques"] },
  impression: { nom: "Impression", aide: "PNG haute définition à 300 DPI et PSD.", dpi: 300, formats: ["png", "psd"] },
  reseaux: { nom: "Réseaux sociaux", aide: "PNG carré sur fond blanc, léger.", dpi: 72, formats: ["png"] },
};

/** Un coloris à exporter (null = trait seul). */
export interface Coloris { nom: string; hex: string | null; pantone: string }

export interface Demande {
  /** Plusieurs coloris = export par lot ; vide = couleur du projet. */
  coloris?: Coloris[];
  vues: Vue[];
  tailles: Taille[];
  formats: Format[];
  dpi: number;
  fondTransparent: boolean;
}

const nettoyer = (s: string) =>
  (s || "sans-nom").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "") || "sans-nom";

/** [Référence]_[Modèle]_[Couleur]_[Vue]_[Taille]_[Date].ext */
export function nomFichier(p: Projet, vue: Vue | null, t: Taille | null, ext: string) {
  const date = new Date().toISOString().slice(0, 10);
  const coul = p.couleur.traitSeul ? "trait" : nettoyer(p.couleur.pantone || p.couleur.principale.replace("#", ""));
  return [nettoyer(p.reference), nettoyer(p.nom), coul, vue ? NOMS_VUES[vue] : null, t, date].filter(Boolean).join("_") + "." + ext;
}

export function taillePx(r: Rendu, dpi: number) {
  return { l: mmEnPx(r.viewBox.l, dpi), h: mmEnPx(r.viewBox.h, dpi) };
}

/** Avertissements avant export (limites Procreate, taille de fichier). */
export function avertissements(p: Projet, d: Demande): string[] {
  const out: string[] = [];
  const r = rendreProjet(p, d.vues[0] || "face", d.tailles[0] || "M", "av");
  const { l, h } = taillePx(r, d.dpi);
  if (Math.max(l, h) > PROCREATE.coteMaxPx) out.push(`La toile fera ${l} × ${h} px : trop grand pour Procreate. Choisis un DPI plus bas.`);
  if (d.formats.includes("psd")) {
    const nb = r.calques.filter((c) => !c.vide).length;
    const dispo = calquesProcreateEstimes(l, h);
    if (nb > dispo) out.push(`À ${d.dpi} DPI, Procreate risque de limiter la toile à environ ${dispo} calques (le PSD en contient ${nb}). Si l'import échoue, réexporte en 150 DPI.`);
  }
  const n = d.vues.length * d.tailles.length;
  if (n * l * h > 400e6) out.push("Export lourd : il peut prendre une minute sur iPad.");
  return out;
}

const pause = () => new Promise((ok) => setTimeout(ok, 0));

type Images = Map<string, HTMLImageElement>;

async function calquesCanvas(r: Rendu, dpi: number, images: Images) {
  const out: { id: string; nom: string; canvas: HTMLCanvasElement; fusion: string; masque: boolean; groupe?: string }[] = [];
  for (const c of r.calques) {
    if (c.vide) continue;
    await pause(); // laisse l'interface respirer entre deux calques
    out.push({ id: c.id, nom: c.nom, canvas: calqueCanvas(r, c.id, dpi, images), fusion: c.fusion, masque: c.masque, groupe: c.groupe });
  }
  return { out };
}

/** Calques → arborescence PSD (les calques d'un même groupe vont dans un dossier). */
function arborescence(out: Awaited<ReturnType<typeof calquesCanvas>>["out"]) {
  const enfants: any[] = [];
  for (const c of out) {
    const calque = { name: c.nom, canvas: c.canvas, left: 0, top: 0, hidden: c.masque, blendMode: c.fusion === "multiply" ? "multiply" : c.fusion === "screen" ? "screen" : "normal", opacity: 1 };
    const dernier = enfants[enfants.length - 1];
    if (c.groupe && dernier?.children && dernier.name === c.groupe) dernier.children.push(calque);
    else if (c.groupe) enfants.push({ name: c.groupe, opened: true, children: [calque] });
    else enfants.push(calque);
  }
  return enfants;
}

/** Carte de déplacement : le relief du vêtement en niveaux de gris (gris moyen = à plat). */
function carteDeplacement(p: Projet, vue: Vue, t: Taille, dpi: number): HTMLCanvasElement {
  const gris = { ...p, couleur: { ...p.couleur, traitSeul: false, principale: "#808080", cotes: "#808080", interieur: "#606060" }, matiere: { ...p.matiere, effet: "uni" }, elements: [] };
  const r = rendreProjet(gris, vue, t, "dep");
  const c = calqueCanvas(r, "base", dpi);
  const g = c.getContext("2d")!;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = "multiply"; g.drawImage(calqueCanvas(r, "ombres", dpi), 0, 0);
  g.globalCompositeOperation = "screen"; g.drawImage(calqueCanvas(r, "lumieres", dpi), 0, 0);
  return c;
}

/** Produit tous les fichiers demandés. */
export function avecColoris(p: Projet, c: Coloris): Projet {
  return { ...p, couleur: c.hex ? { ...p.couleur, traitSeul: false, principale: c.hex, pantone: c.pantone } : { ...p.couleur, traitSeul: true } };
}

export async function produire(p: Projet, d: Demande, progression?: (t: string) => void): Promise<{ nom: string; donnees: Uint8Array; type: string }[]> {
  const lots = d.coloris && d.coloris.length ? d.coloris : [null];
  const tous: { nom: string; donnees: Uint8Array; type: string }[] = [];
  for (const c of lots) {
    const pc = c ? avecColoris(p, c) : p;
    tous.push(...(await produireUn(pc, { ...d, formats: d.formats.filter((f) => f !== "json" && f !== "pdf") }, (t) => progression?.(`${c ? c.nom + " · " : ""}${t}`))));
  }
  if (d.formats.includes("pdf")) {
    progression?.("Fiche technique");
    tous.push({ nom: nomFichier(p, null, null, "pdf").replace(".pdf", "_fiche-technique.pdf"), donnees: await ficheTechnique(p), type: "application/pdf" });
  }
  if (d.formats.includes("json")) {
    tous.push({ nom: nomFichier(p, null, null, "palma.json"), donnees: new TextEncoder().encode(JSON.stringify(p, null, 2)), type: "application/json" });
  }
  return tous;
}

async function produireUn(p: Projet, d: Demande, progression?: (t: string) => void): Promise<{ nom: string; donnees: Uint8Array; type: string }[]> {
  const fichiers: { nom: string; donnees: Uint8Array; type: string }[] = [];
  const u8 = async (b: Blob) => new Uint8Array(await b.arrayBuffer());
  const images = await precharger([...(p.elements || []).map((e) => e.visuel).filter((v): v is string => !!v), ...(p.modele ? p.modele.vues.map((v) => "stockage:catalogue/" + v.chemin) : [])]);
  for (const t of d.tailles) {
    for (const vue of d.vues) {
      progression?.(`${NOMS_VUES[vue]} · ${t}`);
      const r = rendreProjet(p, vue, t, `ex-${vue}-${t}`);
      if (!d.fondTransparent) r.calques.forEach((c) => { if (c.id === "fond") c.masque = false; });
      if (d.formats.includes("details")) {
        const comp = compositeCanvas(r, d.dpi, !d.fondTransparent, images);
        const k = pxParMm(d.dpi);
        for (const z of details(r)) {
          await pause();
          const c = document.createElement("canvas");
          c.width = Math.round(z.l * k); c.height = Math.round(z.h * k);
          const g = c.getContext("2d")!;
          if (!d.fondTransparent) { g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); }
          g.drawImage(comp, (z.x - r.viewBox.x) * k, (z.y - r.viewBox.y) * k, z.l * k, z.h * k, 0, 0, c.width, c.height);
          fichiers.push({ nom: nomFichier(p, vue, t, "").replace(/\.$/, "") + `_detail-${z.id}.png`, donnees: await u8(await versBlob(c)), type: "image/png" });
        }
      }
      if (d.formats.includes("deplacement")) {
        await pause();
        fichiers.push({ nom: nomFichier(p, vue, t, "").replace(/\.$/, "") + "_carte-deplacement.png", donnees: await u8(await versBlob(carteDeplacement(p, vue, t, d.dpi))), type: "image/png" });
      }
      if (d.formats.includes("svg")) {
        fichiers.push({ nom: nomFichier(p, vue, t, "svg"), donnees: new TextEncoder().encode(svgDe(r)), type: "image/svg+xml" });
      }
      if (d.formats.includes("png")) {
        await pause();
        const c = compositeCanvas(r, d.dpi, !d.fondTransparent, images);
        fichiers.push({ nom: nomFichier(p, vue, t, "png"), donnees: await u8(await versBlob(c)), type: "image/png" });
      }
      if (d.formats.includes("psd") || d.formats.includes("png_calques")) {
        const { out } = await calquesCanvas(r, d.dpi, images);
        if (d.formats.includes("png_calques")) {
          for (const [i, c] of out.entries()) {
            fichiers.push({ nom: nomFichier(p, vue, t, "").replace(/\.$/, "") + `_${String(i + 1).padStart(2, "0")}-${nettoyer(c.nom)}.png`, donnees: await u8(await versBlob(c.canvas)), type: "image/png" });
          }
        }
        if (d.formats.includes("psd")) {
          const composite = compositeCanvas(r, d.dpi, !d.fondTransparent, images);
          const { width: l, height: h } = composite;
          const psd = writePsd(
            {
              width: l,
              height: h,
              canvas: composite,
              imageResources: {
                resolutionInfo: {
                  horizontalResolution: d.dpi,
                  horizontalResolutionUnit: "PPI",
                  widthUnit: "Centimeters",
                  verticalResolution: d.dpi,
                  verticalResolutionUnit: "PPI",
                  heightUnit: "Centimeters",
                },
              },
              // ag-psd : premier = calque du bas.
              children: arborescence(out),
            } as any,
            { generateThumbnail: true },
          );
          fichiers.push({ nom: nomFichier(p, vue, t, "psd"), donnees: new Uint8Array(psd), type: "image/vnd.adobe.photoshop" });
        }
      }
    }
  }
  return fichiers;
}

/** Un seul fichier → tel quel ; plusieurs → un .zip. */
export function emballer(p: Projet, fichiers: { nom: string; donnees: Uint8Array; type: string }[]): File {
  if (fichiers.length === 1) return new File([fichiers[0].donnees], fichiers[0].nom, { type: fichiers[0].type });
  const contenu: Record<string, Uint8Array> = {};
  fichiers.forEach((f) => (contenu[f.nom] = f.donnees));
  const zip = zipSync(contenu, { level: 6 });
  return new File([zip], nomFichier(p, null, null, "zip"), { type: "application/zip" });
}

/** Sur iPad : menu de partage (Procreate, Fichiers, AirDrop). Ailleurs : téléchargement. */
export async function livrer(f: File): Promise<"partage" | "telechargement"> {
  const nav = navigator as any;
  if (nav.canShare && nav.canShare({ files: [f] }) && /iPad|iPhone|Macintosh/.test(navigator.userAgent) && "ontouchend" in document) {
    try {
      await nav.share({ files: [f], title: f.name });
      return "partage";
    } catch (e: any) {
      if (e?.name === "AbortError") return "partage";
    }
  }
  const url = URL.createObjectURL(f);
  const a = document.createElement("a");
  a.href = url; a.download = f.name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return "telechargement";
}
