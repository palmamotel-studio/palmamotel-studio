import type { Dessin, Trace, ZoneImpression, Pt, Cote, Finitions } from "./types";
import { FINITIONS_DEFAUT } from "./types";
import { opsElement, svgOps, nomType, type Element } from "./elements";

/**
 * RENDU — transforme un dessin (en mm) en calques SVG.
 * Le même rendu sert à l'écran et à tous les exports : ce qu'on voit est ce qu'on exporte.
 */

export interface Couleurs {
  /** null = trait seul (fond blanc). */
  principale: string | null;
  cotes: string | null;
  interieur: string | null;
  fil: string | null;
  accessoires: string;
}

export interface Retouche {
  pts: Pt[];
  epaisseur: number; // mm
  couleur: string;
}

export interface OptionsRendu {
  couleurs: Couleurs;
  zones: ZoneImpression[];
  zonesActives: string[];
  retouches: Retouche[];
  /** Marge autour du vêtement, en mm. */
  marge: number;
  fond: string;
  finitions?: Finitions;
  /** Effet matière : uni, chiné, garment dye, délavé, acid wash. */
  effet?: string;
  grammage?: number | null;
  elements?: Element[];
  /** Taille affichée (pour l'étiquette de taille). */
  taille?: string;
  /** Résout un visuel importé en URL affichable (écran). */
  visuel?: (src: string) => string | null;
}

export type ModeFusion = "normal" | "multiply" | "screen" | "overlay";

export interface Calque {
  id: string;
  nom: string;
  /** Contenu SVG (sans balise <svg>), en coordonnées mm. */
  contenu: string;
  fusion: ModeFusion;
  masque: boolean;
  /** Vide = pas besoin de l'exporter. */
  vide: boolean;
  /** Dossier du PSD (ex. « Éléments »). */
  groupe?: string;
}

export interface Rendu {
  viewBox: { x: number; y: number; l: number; h: number };
  defs: string;
  calques: Calque[];
  /** Données sources, pour le rendu direct sur canvas (export). */
  source: { dessin: Dessin; options: OptionsRendu; teintes: Teintes };
}

/** Couleurs résolues (après « auto »). */
export interface Teintes {
  tissu: string; cotes: string; interieur: string; fil: string; contour: string; fonce: boolean; accessoires: string; colore: boolean;
}

export function teintes(c: Couleurs): Teintes {
  const tissu = c.principale ?? "#ffffff";
  const fonce = c.principale ? luminance(c.principale) < 0.3 : false;
  return {
    tissu,
    cotes: c.cotes ?? tissu,
    interieur: c.interieur ?? (c.principale ? assombrir(c.principale, 0.22) : "#d4d4d4"),
    fil: c.fil ?? (fonce ? "#d9d9d9" : NOIR),
    contour: fonce && c.principale ? "#0b0b0b" : NOIR,
    fonce,
    accessoires: c.accessoires,
    colore: !!c.principale,
  };
}

export const NOIR = "#1b1b1b";
export const ROSE = "#E0457B";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

export function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

/** Styles dépendant des finitions, partagés entre l'écran (SVG) et l'export (canvas). */
export function styleAccessoire(t: Trace, f: Finitions, accessoires: string, fil: string) {
  const nom = t.nom || "";
  const zip = /^(Zip|Tirette|Dents)/.test(nom);
  const couleur = zip ? f.couleurZip : /^Embout/.test(nom) && f.embout === "metal" ? "#b9b9b9" : /^Œillet/.test(nom) ? (f.oeillet === "metal" ? "#b9b9b9" : fil) : accessoires;
  const large = /^Cordon/.test(nom) && f.cordon === "plat" ? 5.2 : zip && f.zip === "invisible" ? 1.2 : 3.6;
  return { couleur, large };
}
/** Intensité des plis selon le grammage : un tissu léger plisse plus qu'un molleton épais. */
export const facteurPlis = (g?: number | null) => (!g ? 1 : g < 180 ? 1.35 : g > 350 ? 0.7 : 1);

/** Calcule le rendu complet d'une vue. */
export function rendre(d: Dessin, o: OptionsRendu, idUnique = "pm"): Rendu {
  const b = d.boite;
  const vb = { x: b.x - o.marge, y: b.y - o.marge, l: b.l + 2 * o.marge, h: b.h + 2 * o.marge };

  // Occultation : chaque tracé est masqué par les surfaces dessinées après lui
  // (ex. une manche posée sur le corps cache le contour du corps).
  const remplis = d.traces.map((t, i) => ({ t, i })).filter(({ t }) => t.role === "piece" || t.role === "cote");
  const masques: string[] = [];
  const idMasque = new Map<number, string>(); // nb d'occultants → id
  const masquePour = (i: number): string | null => {
    const apres = remplis.filter((r) => r.i > i);
    if (!apres.length) return null;
    const cle = apres[0].i;
    if (!idMasque.has(cle)) {
      const id = `${idUnique}-m${cle}`;
      idMasque.set(cle, id);
      masques.push(
        `<mask id="${id}" maskUnits="userSpaceOnUse" x="${vb.x}" y="${vb.y}" width="${vb.l}" height="${vb.h}">` +
          `<rect x="${vb.x}" y="${vb.y}" width="${vb.l}" height="${vb.h}" fill="#fff"/>` +
          apres.map((r) => `<path d="${r.t.d}" fill="#000"/>`).join("") +
          `</mask>`,
      );
    }
    return idMasque.get(cle)!;
  };
  const m = (i: number) => {
    const id = masquePour(i);
    return id ? ` mask="url(#${id})"` : "";
  };

  const c = o.couleurs;
  const T = teintes(c);
  const { tissu, cotes, interieur, fil, contour, fonce } = T;
  const f = o.finitions ?? FINITIONS_DEFAUT;
  const kp = facteurPlis(o.grammage);

  const base: string[] = [], contours: string[] = [], coutures: string[] = [], ombres: string[] = [], elements: string[] = [];
  d.traces.forEach((t: Trace, i) => {
    const mk = m(i);
    switch (t.role) {
      case "piece":
        base.push(`<path d="${t.d}" fill="${tissu}"${mk}/>`);
        contours.push(`<path d="${t.d}" fill="none" stroke="${contour}" stroke-width="1.7" stroke-linejoin="round"${mk}/>`);
        break;
      case "cote":
        base.push(`<path d="${t.d}" fill="${cotes}"${mk}/>`);
        contours.push(`<path d="${t.d}" fill="none" stroke="${contour}" stroke-width="1.4" stroke-linejoin="round"${mk}/>`);
        break;
      case "interieur":
        base.push(`<path d="${t.d}" fill="${interieur}"${mk}/>`);
        contours.push(`<path d="${t.d}" fill="none" stroke="${contour}" stroke-width="1.2"${mk}/>`);
        break;
      case "couture":
        coutures.push(`<path d="${t.d}" fill="none" stroke="${fil}" stroke-width="0.6"${mk}/>`);
        break;
      case "surpiqure":
        if (f.piqure === "double")
          coutures.push(`<g${mk}><path d="${t.d}" fill="none" stroke="${fil}" stroke-width="2.9" stroke-dasharray="2.4 1.6"/><path d="${t.d}" fill="none" stroke="${tissu}" stroke-width="1.8" stroke-dasharray="2.4 1.6"/></g>`);
        else coutures.push(`<path d="${t.d}" fill="none" stroke="${fil}" stroke-width="0.55" stroke-dasharray="2.4 1.6"${mk}/>`);
        break;
      case "pli":
        if (t.nom?.startsWith("Côtes")) ombres.push(`<path d="${t.d}" fill="none" stroke="${fonce ? "#000" : "#6b6b6b"}" stroke-opacity="0.55" stroke-width="${f.cotes === "2x2" ? 1 : 0.45}"${mk}/>`);
        else ombres.push(`<path d="${t.d}" fill="none" stroke="${fonce ? "#000" : "#6b6b6b"}" stroke-opacity="${Math.min(0.9, 0.55 * kp)}" stroke-width="0.45" stroke-linecap="round"${mk}/>`);
        break;
      case "ombre":
        ombres.push(`<path d="${t.d}" fill="#000" fill-opacity="${((c.principale ? 0.16 : 0.14) * kp).toFixed(3)}"${mk}/>`);
        break;
      case "accessoire": {
        const ferme = /Z\s*$/i.test(t.d.trim()) || /a /.test(t.d);
        const st = styleAccessoire(t, f, c.accessoires, fil);
        elements.push(
          ferme
            ? `<path d="${t.d}" fill="${st.couleur}" stroke="${NOIR}" stroke-width="0.6"${mk}/>`
            : `<path d="${t.d}" fill="none" stroke="${NOIR}" stroke-width="${st.large}" stroke-linecap="round"${mk}/><path d="${t.d}" fill="none" stroke="${st.couleur}" stroke-width="${Math.max(0.6, st.large - 1.2)}" stroke-linecap="round"${mk}/>`,
        );
        break;
      }
    }
  });

  // Zones « TON DESIGN ICI » : formes pleines servant de masque d'écrêtage dans Procreate.
  const zonesActives = o.zones.filter((z) => o.zonesActives.includes(z.id));

  // Repères : zones en pointillés + cotes + règle graduée de 10 cm.
  const reperes: string[] = [];
  zonesActives.forEach((z) => {
    reperes.push(`<rect x="${z.cx - z.l / 2}" y="${z.y}" width="${z.l}" height="${z.h}" fill="none" stroke="${ROSE}" stroke-width="0.6" stroke-dasharray="3 2"/>`);
    reperes.push(`<text x="${z.cx - z.l / 2 + 2}" y="${z.y - 2.5}" font-family="Helvetica, Arial, sans-serif" font-size="9" fill="${ROSE}">${esc(z.nom)} · ${fmtCm(z.l)} × ${fmtCm(z.h)} cm</text>`);
  });
  reperes.push(regle(vb.x + 12, vb.y + vb.h - 14));

  const retouches = o.retouches.map(
    (r) => `<path d="${r.pts.map((p, i) => `${i ? "L" : "M"} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ")}" fill="none" stroke="${r.couleur}" stroke-width="${r.epaisseur}" stroke-linecap="round" stroke-linejoin="round"/>`,
  );

  // Effet matière et lumières : limités aux surfaces du vêtement.
  const surfaces = remplis.map((r) => r.t.d);
  const defs: string[] = [`<clipPath id="${idUnique}-tissu">${surfaces.map((d) => `<path d="${d}"/>`).join("")}</clipPath>`];
  const effet = o.effet && o.effet !== "uni" ? o.effet : null;
  let texture = "";
  if (effet) {
    const freq = effet === "chiné" ? 0.9 : effet === "garment dye" ? 0.02 : 0.012;
    const force = effet === "chiné" ? 0.22 : effet === "acid wash" ? 0.5 : effet === "délavé" ? 0.3 : 0.18;
    defs.push(`<filter id="${idUnique}-effet" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="${effet === "chiné" ? 2 : 3}" seed="7"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 ${force}"/></feComponentTransfer></filter>`);
    texture = `<g clip-path="url(#${idUnique}-tissu)"><rect x="${vb.x}" y="${vb.y}" width="${vb.l}" height="${vb.h}" filter="url(#${idUnique}-effet)"/></g>`;
  }
  const corps = d.boite;
  defs.push(`<radialGradient id="${idUnique}-lum" cx="${corps.x + corps.l / 2}" cy="${corps.y + corps.h * 0.32}" r="${corps.l * 0.35}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff" stop-opacity="${c.principale ? 0.22 : 0}"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`);
  const lumieres = c.principale ? `<g clip-path="url(#${idUnique}-tissu)"><rect x="${vb.x}" y="${vb.y}" width="${vb.l}" height="${vb.h}" fill="url(#${idUnique}-lum)"/></g>` : "";

  const els = o.elements ?? [];
  const calquesElements: Calque[] = els.map((e, i) => ({
    id: `el-${e.id}`,
    nom: `${nomType(e.type)}${els.filter((x) => x.type === e.type).length > 1 ? " " + (els.filter((x, j) => x.type === e.type && j <= i).length) : ""}`,
    contenu: `<g transform="translate(${e.x} ${e.y}) rotate(${e.rotation})">${svgOps(opsElement(e, o.taille ?? "M"), o.visuel ?? ((x) => (x.startsWith("data:") ? x : null)))}</g>`,
    fusion: "normal",
    masque: false,
    vide: false,
    groupe: "Éléments",
  }));

  const calques: Calque[] = [
    { id: "fond", nom: "Fond", contenu: `<rect x="${vb.x}" y="${vb.y}" width="${vb.l}" height="${vb.h}" fill="${o.fond}"/>`, fusion: "normal", masque: true, vide: false },
    { id: "base", nom: "Couleur de base du vêtement", contenu: base.join(""), fusion: "normal", masque: false, vide: !base.length },
    { id: "texture", nom: `Effet matière — ${effet ?? "uni"}`, contenu: texture, fusion: "multiply", masque: false, vide: !texture },
    ...zonesActives.map((z) => ({
      id: `zone-${z.id}`,
      nom: `TON DESIGN ICI — ${z.nom}`,
      contenu: `<rect x="${z.cx - z.l / 2}" y="${z.y}" width="${z.l}" height="${z.h}" fill="#ffffff" fill-opacity="0.001"/>`,
      fusion: "normal" as ModeFusion,
      masque: false,
      vide: false,
    })),
    { id: "contours", nom: "Contours", contenu: contours.join(""), fusion: "normal", masque: false, vide: !contours.length },
    { id: "coutures", nom: "Coutures", contenu: coutures.join(""), fusion: "normal", masque: false, vide: !coutures.length },
    { id: "elements", nom: "Accessoires du vêtement", contenu: elements.join(""), fusion: "normal", masque: false, vide: !elements.length, groupe: "Éléments" },
    ...calquesElements,
    { id: "ombres", nom: "Ombres et plis", contenu: ombres.join(""), fusion: "multiply", masque: false, vide: !ombres.length },
    { id: "lumieres", nom: "Lumières", contenu: lumieres, fusion: "screen", masque: false, vide: !lumieres },
    { id: "retouches", nom: "Retouches", contenu: retouches.join(""), fusion: "normal", masque: false, vide: !retouches.length },
    { id: "reperes", nom: "REPÈRES — à masquer", contenu: reperes.join(""), fusion: "normal", masque: true, vide: false },
  ];
  return { viewBox: vb, defs: masques.join("") + defs.join(""), calques, source: { dessin: d, options: o, teintes: T } };
}

/** Assemble un SVG autonome (un ou plusieurs calques), dimensionné en mm. */
export function svgDe(r: Rendu, ids?: string[], { avecMasques = false } = {}): string {
  const vb = r.viewBox;
  const corps = r.calques
    .filter((c) => (ids ? ids.includes(c.id) : avecMasques || !c.masque))
    .map((c) => `<g id="${c.id}" data-nom="${esc(c.nom)}"${c.fusion !== "normal" ? ` style="mix-blend-mode:${c.fusion}"` : ""}>${c.contenu}</g>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.x} ${vb.y} ${vb.l} ${vb.h}" width="${vb.l}mm" height="${vb.h}mm"><defs>${r.defs}</defs>${corps}</svg>`;
}

/** Ligne de cote (mesure) dessinée sur le vêtement. */
export function svgCote(cote: Cote, texte: string, couleur = ROSE): string {
  const [ax, ay] = cote.a, [bx, by] = cote.b;
  const dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1;
  const nx = -dy / l, ny = dx / l, k = cote.decalage ?? 0;
  const a: Pt = [ax + nx * k, ay + ny * k], b: Pt = [bx + nx * k, by + ny * k];
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
  const fl = (p: Pt, s: number) => `M ${p[0]} ${p[1]} l ${(dx / l) * 5 * s + nx * 2.5} ${(dy / l) * 5 * s + ny * 2.5} M ${p[0]} ${p[1]} l ${(dx / l) * 5 * s - nx * 2.5} ${(dy / l) * 5 * s - ny * 2.5}`;
  return (
    `<g class="cote">` +
    `<path d="M ${a[0]} ${a[1]} L ${b[0]} ${b[1]} ${fl(a, 1)} ${fl(b, -1)}" stroke="${couleur}" stroke-width="2" fill="none" stroke-linecap="round"/>` +
    `<rect x="${mx - 34}" y="${my - 12}" width="68" height="24" rx="12" fill="${couleur}"/>` +
    `<text x="${mx}" y="${my + 6}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="16" font-weight="700" fill="#fff">${esc(texte)}</text>` +
    `</g>`
  );
}

function regle(x: number, y: number): string {
  let s = `<g><path d="M ${x} ${y} h 100" stroke="${ROSE}" stroke-width="0.6"/>`;
  for (let i = 0; i <= 100; i += 10) s += `<path d="M ${x + i} ${y} v ${i % 50 === 0 ? -5 : -3}" stroke="${ROSE}" stroke-width="0.5"/>`;
  s += `<text x="${x}" y="${y + 7}" font-family="Helvetica, Arial, sans-serif" font-size="5.5" fill="${ROSE}">10 cm — échelle réelle</text></g>`;
  return s;
}

const fmtCm = (mm: number) => (Math.round(mm) / 10).toLocaleString("fr-FR");

function assombrir(hex: string, k: number): string {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  const ch = (v: number) => Math.round(v * (1 - k)).toString(16).padStart(2, "0");
  return `#${ch((n >> 16) & 255)}${ch((n >> 8) & 255)}${ch(n & 255)}`;
}
