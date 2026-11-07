import { writePsd } from "ag-psd";
import { zipSync } from "fflate";
import type { Projet } from "../etat/projet";
import type { Taille, Vue } from "../moteur/types";
import { NOMS_VUES } from "../moteur/types";
import { rendreProjet } from "../etat/calcul";
import { svgDe, type Rendu } from "../moteur/rendu";
import { mmEnPx, calquesProcreateEstimes, PROCREATE } from "../moteur/echelle";
import { versBlob } from "./raster";
import { calqueCanvas, compositeCanvas } from "./canvas";

export type Format = "psd" | "png" | "png_calques" | "svg" | "json";
export type Prereglage = "procreate" | "canva" | "impression" | "reseaux";

export const PREREGLAGES: Record<Prereglage, { nom: string; aide: string; dpi: number; formats: Format[] }> = {
  procreate: { nom: "Procreate (iPad)", aide: "PSD en calques à l'échelle réelle, prêt à ouvrir dans Procreate. 150 DPI garde assez de calques disponibles sur iPad.", dpi: 150, formats: ["psd"] },
  canva: { nom: "Canva", aide: "PNG transparent + un PNG par calque (Canva ne gère pas les calques).", dpi: 150, formats: ["png", "png_calques"] },
  impression: { nom: "Impression", aide: "PNG haute définition à 300 DPI et PSD.", dpi: 300, formats: ["png", "psd"] },
  reseaux: { nom: "Réseaux sociaux", aide: "PNG carré sur fond blanc, léger.", dpi: 72, formats: ["png"] },
};

export interface Demande {
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

async function calquesCanvas(r: Rendu, dpi: number) {
  const out: { id: string; nom: string; canvas: HTMLCanvasElement; fusion: string; masque: boolean }[] = [];
  for (const c of r.calques) {
    if (c.vide) continue;
    await pause(); // laisse l'interface respirer entre deux calques
    out.push({ id: c.id, nom: c.nom, canvas: calqueCanvas(r, c.id, dpi), fusion: c.fusion, masque: c.masque });
  }
  return { out };
}

/** Produit tous les fichiers demandés. */
export async function produire(p: Projet, d: Demande, progression?: (t: string) => void): Promise<{ nom: string; donnees: Uint8Array; type: string }[]> {
  const fichiers: { nom: string; donnees: Uint8Array; type: string }[] = [];
  const u8 = async (b: Blob) => new Uint8Array(await b.arrayBuffer());
  for (const t of d.tailles) {
    for (const vue of d.vues) {
      progression?.(`${NOMS_VUES[vue]} · ${t}`);
      const r = rendreProjet(p, vue, t, `ex-${vue}-${t}`);
      if (!d.fondTransparent) r.calques.forEach((c) => { if (c.id === "fond") c.masque = false; });
      if (d.formats.includes("svg")) {
        fichiers.push({ nom: nomFichier(p, vue, t, "svg"), donnees: new TextEncoder().encode(svgDe(r)), type: "image/svg+xml" });
      }
      if (d.formats.includes("png")) {
        await pause();
        const c = compositeCanvas(r, d.dpi, !d.fondTransparent);
        fichiers.push({ nom: nomFichier(p, vue, t, "png"), donnees: await u8(await versBlob(c)), type: "image/png" });
      }
      if (d.formats.includes("psd") || d.formats.includes("png_calques")) {
        const { out } = await calquesCanvas(r, d.dpi);
        if (d.formats.includes("png_calques")) {
          for (const [i, c] of out.entries()) {
            fichiers.push({ nom: nomFichier(p, vue, t, "").replace(/\.$/, "") + `_${String(i + 1).padStart(2, "0")}-${nettoyer(c.nom)}.png`, donnees: await u8(await versBlob(c.canvas)), type: "image/png" });
          }
        }
        if (d.formats.includes("psd")) {
          const composite = compositeCanvas(r, d.dpi, !d.fondTransparent);
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
              children: out.map((c) => ({
                name: c.nom,
                canvas: c.canvas,
                left: 0,
                top: 0,
                hidden: c.masque,
                blendMode: c.fusion === "multiply" ? "multiply" : "normal",
                opacity: 1,
              })),
            } as any,
            { generateThumbnail: true },
          );
          fichiers.push({ nom: nomFichier(p, vue, t, "psd"), donnees: new Uint8Array(psd), type: "image/vnd.adobe.photoshop" });
        }
      }
    }
  }
  if (d.formats.includes("json")) {
    fichiers.push({ nom: nomFichier(p, null, null, "palma.json"), donnees: new TextEncoder().encode(JSON.stringify(p, null, 2)), type: "application/json" });
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
