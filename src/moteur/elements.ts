import type { Mesures, Vue } from "./types";

/**
 * ÉLÉMENTS posés sur le mock-up (étape 5) : étiquettes, patchs, hang tags, boutons…
 * Toutes les dimensions sont réelles, en mm. Chaque élément est dessiné à partir de
 * primitives (« ops ») traduites à l'identique en SVG (écran) et sur canvas (export).
 */
export type TypeElement =
  | "etiquette_col" | "etiquette_drapeau" | "etiquette_compo" | "etiquette_taille"
  | "hang_tag" | "patch" | "bouton" | "pression" | "oeillet";

export interface Element {
  id: string;
  type: TypeElement;
  vue: Vue;
  /** Centre, en mm (repère du vêtement). */
  x: number;
  y: number;
  l: number;
  h: number;
  rotation: number;
  couleur: string;
  /** Matière : tissée, imprimée, satin, coton, cuir, brodé, PVC, métal… */
  matiere: string;
  forme: "rect" | "rond" | "ovale";
  texte: string;
  /** Visuel importé : « data:… » ou « stockage:chemin » (espace partagé). */
  visuel: string | null;
}

export const TYPES_ELEMENTS: { type: TypeElement; nom: string; matieres: string[]; l: number; h: number; couleur: string; forme?: Element["forme"] }[] = [
  { type: "etiquette_col", nom: "Étiquette de col", matieres: ["tissée", "imprimée (tagless)", "satin", "coton"], l: 50, h: 22, couleur: "#1b1b1b" },
  { type: "etiquette_drapeau", nom: "Étiquette drapeau", matieres: ["tissée", "satin", "coton"], l: 22, h: 12, couleur: "#1b1b1b" },
  { type: "etiquette_compo", nom: "Étiquette composition / entretien", matieres: ["satin", "coton", "nylon"], l: 30, h: 70, couleur: "#f4f4f2" },
  { type: "etiquette_taille", nom: "Étiquette de taille", matieres: ["tissée", "satin", "imprimée"], l: 14, h: 12, couleur: "#1b1b1b" },
  { type: "hang_tag", nom: "Étiquette volante (hang tag)", matieres: ["carton", "carton kraft", "PVC"], l: 50, h: 90, couleur: "#ECE2CC" },
  { type: "patch", nom: "Patch", matieres: ["cuir", "tissé", "brodé", "caoutchouc / PVC"], l: 70, h: 45, couleur: "#8a5a3c", forme: "rect" },
  { type: "bouton", nom: "Bouton", matieres: ["corozo", "métal", "plastique"], l: 15, h: 15, couleur: "#3a3a3a", forme: "rond" },
  { type: "pression", nom: "Pression", matieres: ["métal", "plastique"], l: 13, h: 13, couleur: "#b9b9b9", forme: "rond" },
  { type: "oeillet", nom: "Œillet", matieres: ["métal", "brodé"], l: 10, h: 10, couleur: "#b9b9b9", forme: "rond" },
];
export const nomType = (t: TypeElement) => TYPES_ELEMENTS.find((x) => x.type === t)?.nom ?? t;

/** Position par défaut d'un nouvel élément, à partir des mesures de la pièce. */
export function positionParDefaut(type: TypeElement, m: Mesures): { vue: Vue; x: number; y: number } {
  const demi = (m.demi_poitrine ?? m.largeur_bas ?? 540) / 2;
  const L = m.longueur ?? 700;
  switch (type) {
    case "etiquette_col": return { vue: "dos", x: 0, y: 40 };
    case "etiquette_taille": return { vue: "dos", x: 0, y: 64 };
    case "etiquette_drapeau": return { vue: "face", x: -demi + 6, y: L - 70 };
    case "etiquette_compo": return { vue: "dos", x: demi - 50, y: L - 170 };
    case "hang_tag": return { vue: "face", x: demi * 0.55, y: 150 };
    case "patch": return { vue: "face", x: demi * 0.42, y: 170 };
    default: return { vue: "face", x: 0, y: L * 0.5 };
  }
}

/* ---------- Primitives ---------- */
export type Op =
  | { k: "path"; d: string; fill?: string; stroke?: string; w?: number; dash?: number[]; opacite?: number }
  | { k: "texte"; x: number; y: number; txt: string; taille: number; couleur: string }
  | { k: "image"; src: string; x: number; y: number; l: number; h: number };

const rect = (x: number, y: number, l: number, h: number, r = 0) =>
  r > 0
    ? `M ${x + r} ${y} h ${l - 2 * r} a ${r} ${r} 0 0 1 ${r} ${r} v ${h - 2 * r} a ${r} ${r} 0 0 1 ${-r} ${r} h ${-(l - 2 * r)} a ${r} ${r} 0 0 1 ${-r} ${-r} v ${-(h - 2 * r)} a ${r} ${r} 0 0 1 ${r} ${-r} Z`
    : `M ${x} ${y} h ${l} v ${h} h ${-l} Z`;
const ellipse = (cx: number, cy: number, rx: number, ry: number) =>
  `M ${cx - rx} ${cy} a ${rx} ${ry} 0 1 0 ${2 * rx} 0 a ${rx} ${ry} 0 1 0 ${-2 * rx} 0 Z`;

export function contraste(hex: string): string {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  const l = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return l < 0.5 ? "#f2f2f2" : "#1b1b1b";
}

/** Dessin d'un élément, centré sur (0,0), sans rotation (appliquée par l'appelant). */
export function opsElement(e: Element, taille: string): Op[] {
  const { l, h } = e;
  const x = -l / 2, y = -h / 2;
  const trait = "#1b1b1b";
  const ops: Op[] = [];
  const visuel = (pad: number) => {
    if (e.visuel) ops.push({ k: "image", src: e.visuel, x: x + pad, y: y + pad, l: l - 2 * pad, h: h - 2 * pad });
  };
  const texte = (t: string, tailleTexte = Math.min(h * 0.45, l / Math.max(3, t.length) * 1.6)) => {
    if (t && !e.visuel) ops.push({ k: "texte", x: 0, y: tailleTexte * 0.35, txt: t, taille: tailleTexte, couleur: contraste(e.couleur) });
  };
  switch (e.type) {
    case "etiquette_col":
    case "etiquette_taille": {
      ops.push({ k: "path", d: rect(x, y, l, h, 0.6), fill: e.couleur, stroke: trait, w: 0.35 });
      visuel(1.2);
      texte(e.type === "etiquette_taille" ? e.texte || taille : e.texte);
      if (e.matiere.startsWith("tissée")) ops.push({ k: "path", d: `M ${x + 1.5} ${y} v ${h} M ${x + l - 1.5} ${y} v ${h}`, stroke: contraste(e.couleur), w: 0.25, dash: [0.8, 0.6] });
      break;
    }
    case "etiquette_drapeau": {
      ops.push({ k: "path", d: rect(x, y, l, h, 0.4), fill: e.couleur, stroke: trait, w: 0.35 });
      ops.push({ k: "path", d: `M ${x + l * 0.35} ${y} v ${h}`, stroke: contraste(e.couleur), w: 0.3 });
      visuel(1);
      texte(e.texte);
      break;
    }
    case "etiquette_compo": {
      ops.push({ k: "path", d: rect(x, y, l, h, 0.4), fill: e.couleur, stroke: trait, w: 0.35, dash: [1.6, 1] });
      if (!e.visuel) {
        const c = contraste(e.couleur);
        for (let i = 0; i < 6; i++) ops.push({ k: "path", d: `M ${x + 4} ${y + 10 + i * (h - 16) / 6} h ${l - 8 - (i % 2) * 6}`, stroke: c, w: 0.5, opacite: 0.6 });
      }
      visuel(2);
      break;
    }
    case "hang_tag": {
      const c = 6;
      ops.push({ k: "path", d: `M 0 ${y - 40} Q 6 ${y - 18} 0 ${y + 8}`, stroke: trait, w: 0.6 });
      ops.push({ k: "path", d: `M ${x + c} ${y} h ${l - 2 * c} l ${c} ${c} v ${h - c} h ${-l} v ${-(h - c)} Z`, fill: e.couleur, stroke: trait, w: 0.45 });
      ops.push({ k: "path", d: ellipse(0, y + 8, 2.5, 2.5), fill: "#ffffff", stroke: trait, w: 0.35 });
      if (e.visuel) ops.push({ k: "image", src: e.visuel, x: x + 4, y: y + 16, l: l - 8, h: h - 20 });
      else texte(e.texte, Math.min(9, l / 6));
      break;
    }
    case "patch": {
      const d = e.forme === "rect" ? rect(x, y, l, h, e.matiere.startsWith("caoutchouc") ? Math.min(l, h) * 0.18 : 2) : ellipse(0, 0, l / 2, h / 2);
      ops.push({ k: "path", d, fill: e.couleur, stroke: trait, w: 0.45 });
      if (e.matiere === "brodé") ops.push({ k: "path", d, stroke: contraste(e.couleur), w: 2.2, opacite: 0.85 });
      else if (e.matiere.startsWith("caoutchouc")) ops.push({ k: "path", d, stroke: "#000", w: 1.6, opacite: 0.25 });
      // Surpiqûre de pose, 3 mm à l'intérieur.
      const di = e.forme === "rect" ? rect(x + 3, y + 3, l - 6, h - 6, 1.5) : ellipse(0, 0, l / 2 - 3, h / 2 - 3);
      if (!e.matiere.startsWith("caoutchouc")) ops.push({ k: "path", d: di, stroke: contraste(e.couleur), w: 0.45, dash: [1.6, 1.1] });
      if (e.visuel) ops.push({ k: "image", src: e.visuel, x: x + 6, y: y + 6, l: l - 12, h: h - 12 });
      else texte(e.texte);
      break;
    }
    default: {
      // Bouton, pression, œillet.
      const r = l / 2;
      ops.push({ k: "path", d: ellipse(0, 0, r, r), fill: e.couleur, stroke: trait, w: 0.4 });
      if (e.type === "bouton") [[-r * 0.25, -r * 0.25], [r * 0.25, -r * 0.25], [-r * 0.25, r * 0.25], [r * 0.25, r * 0.25]].forEach(([a, b]) => ops.push({ k: "path", d: ellipse(a, b, r * 0.12, r * 0.12), fill: trait }));
      if (e.type === "oeillet") ops.push({ k: "path", d: ellipse(0, 0, r * 0.5, r * 0.5), fill: "#ffffff", stroke: trait, w: 0.3 });
      if (e.type === "pression") ops.push({ k: "path", d: ellipse(0, 0, r * 0.6, r * 0.6), stroke: trait, w: 0.3, opacite: 0.7 });
    }
  }
  return ops;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

/** Ops → SVG. `src` résout un visuel (« stockage:… ») en URL affichable. */
export function svgOps(ops: Op[], src: (s: string) => string | null): string {
  return ops
    .map((o) => {
      if (o.k === "path")
        return `<path d="${o.d}" fill="${o.fill ?? "none"}"${o.stroke ? ` stroke="${o.stroke}" stroke-width="${o.w ?? 0.4}"` : ""}${o.dash ? ` stroke-dasharray="${o.dash.join(" ")}"` : ""}${o.opacite !== undefined ? ` opacity="${o.opacite}"` : ""}/>`;
      if (o.k === "texte")
        return `<text x="${o.x}" y="${o.y}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="${o.taille.toFixed(2)}" fill="${o.couleur}">${esc(o.txt)}</text>`;
      const u = src(o.src);
      return u ? `<image href="${esc(u)}" x="${o.x}" y="${o.y}" width="${o.l}" height="${o.h}" preserveAspectRatio="xMidYMid meet"/>` : "";
    })
    .join("");
}

/** Ops → canvas (déjà transformé en mm). */
export function canvasOps(g: CanvasRenderingContext2D, ops: Op[], images: Map<string, CanvasImageSource & { width: number; height: number }>) {
  for (const o of ops) {
    g.save();
    if (o.k === "path") {
      const p = new Path2D(o.d);
      if (o.opacite !== undefined) g.globalAlpha = o.opacite;
      if (o.fill && o.fill !== "none") { g.fillStyle = o.fill; g.fill(p); }
      if (o.stroke) { g.strokeStyle = o.stroke; g.lineWidth = o.w ?? 0.4; g.setLineDash(o.dash ?? []); g.stroke(p); }
    } else if (o.k === "texte") {
      g.fillStyle = o.couleur; g.font = `700 ${o.taille}px Helvetica, Arial, sans-serif`; g.textAlign = "center"; g.fillText(o.txt, o.x, o.y);
    } else {
      const im = images.get(o.src);
      if (im) {
        const k = Math.min(o.l / im.width, o.h / im.height);
        const l = im.width * k, h = im.height * k;
        g.drawImage(im, o.x + (o.l - l) / 2, o.y + (o.h - h) / 2, l, h);
      }
    }
    g.restore();
  }
}
