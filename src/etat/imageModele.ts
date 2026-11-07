import type { Pt } from "../moteur/types";
import { useVisuels } from "./visuels";

/**
 * RETOUCHES DES MODÈLES DU CATALOGUE (images Opus).
 * Opérations non destructives, rejouées dans l'ordre sur l'image d'origine :
 *  - gomme : efface une partie du dessin ;
 *  - remplir : colore une zone fermée (poche, manche…) en gardant les ombres ;
 *  - allonger : insère (ou retire) une bande horizontale ou verticale du dessin,
 *    pour allonger ou raccourcir, élargir ou rétrécir le vêtement à un endroit précis.
 * Coordonnées en mm, dans le repère du projet (image centrée en x, haut à y = 0).
 */
export type OpImage =
  | { t: "gomme"; pts: Pt[]; epaisseur: number }
  | { t: "remplir"; x: number; y: number; couleur: string; tolerance: number }
  | { t: "allonger"; axe: "v" | "h"; pos: number; delta: number };

/** Taille du dessin (mm) après les allongements. */
export function tailleTraitee(l: number, h: number, ops: OpImage[]) {
  for (const o of ops) if (o.t === "allonger") { if (o.axe === "v") h = Math.max(10, h + o.delta); else l = Math.max(10, l + o.delta); }
  return { l, h };
}

/** Clé stable d'un traitement (même image + mêmes opérations = même résultat). */
export function cleTraitee(src: string, l0: number, ops: OpImage[]): string {
  const s = src + "|" + l0.toFixed(2) + "|" + JSON.stringify(ops);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return "traite:" + (h >>> 0).toString(36) + s.length.toString(36);
}

interface Resultat { image: HTMLCanvasElement; remplissage: HTMLCanvasElement | null; masque: HTMLCanvasElement; urls: Record<string, string> }
const enCours = new Map<string, Promise<Resultat>>();
const prets = new Map<string, Resultat>();

/** URL affichable d'un résultat (« clé », « clé#r » remplissages, « clé#m » masque de couleur). */
export function urlTraitee(src: string): string | null {
  const [cle, part] = src.split("#");
  return prets.get(cle)?.urls[part ?? "i"] ?? null;
}
/** Canvas d'un résultat, pour l'export. */
export async function canvasTraite(src: string): Promise<HTMLCanvasElement | null> {
  const [cle, part] = src.split("#");
  const r = prets.get(cle) ?? (await enCours.get(cle));
  if (!r) return null;
  return part === "r" ? r.remplissage : part === "m" ? r.masque : r.image;
}

/** Lance (une fois) le traitement d'une image ; l'aperçu se redessine quand c'est prêt. */
export function demanderTraitement(cle: string, charger: () => Promise<CanvasImageSource & { width: number; height: number } | null>, l0: number, h0: number, ops: OpImage[]) {
  if (prets.has(cle) || enCours.has(cle)) return;
  const p = (async () => {
    const base = await charger();
    if (!base) throw new Error("Image introuvable");
    const r = await traiter(base, l0, h0, ops);
    prets.set(cle, r);
    if (prets.size > 30) { const k = prets.keys().next().value!; Object.values(prets.get(k)!.urls).forEach(URL.revokeObjectURL); prets.delete(k); }
    useVisuels.setState((s) => ({ version: s.version + 1 }));
    return r;
  })();
  enCours.set(cle, p);
  p.catch(() => {}).finally(() => enCours.delete(cle));
}

const toile = (l: number, h: number) => { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(l)); c.height = Math.max(1, Math.round(h)); return c; };

async function traiter(base: CanvasImageSource & { width: number; height: number }, l0: number, h0: number, ops: OpImage[]): Promise<Resultat> {
  let img = toile(base.width, base.height);
  img.getContext("2d")!.drawImage(base, 0, 0);
  let rem: HTMLCanvasElement | null = null;
  const k = img.width / l0; // pixels par mm (constant)
  let L = l0, H = h0;
  const px = (p: Pt): Pt => [(p[0] + L / 2) * k, p[1] * k];

  for (const o of ops) {
    if (o.t === "allonger") {
      const d = Math.round(o.delta * k);
      if (!d) continue;
      const couper = (c: HTMLCanvasElement) => {
        const W = c.width, Hc = c.height;
        if (o.axe === "v") {
          const y = Math.round(Math.min(Hc, Math.max(1, o.pos * k)));
          const n = toile(W, Math.max(1, Hc + d)); const g = n.getContext("2d")!;
          g.drawImage(c, 0, 0, W, y, 0, 0, W, y);
          if (d > 0) { g.drawImage(c, 0, y - 1, W, 1, 0, y, W, d); g.drawImage(c, 0, y, W, Hc - y, 0, y + d, W, Hc - y); }
          else { const fin = Math.min(Hc, y - d); g.drawImage(c, 0, fin, W, Hc - fin, 0, y, W, Hc - fin); }
          return n;
        }
        const x = Math.round(Math.min(W, Math.max(1, (o.pos + L / 2) * k)));
        const n = toile(Math.max(1, W + d), Hc); const g = n.getContext("2d")!;
        g.drawImage(c, 0, 0, x, Hc, 0, 0, x, Hc);
        if (d > 0) { g.drawImage(c, x - 1, 0, 1, Hc, x, 0, d, Hc); g.drawImage(c, x, 0, W - x, Hc, x + d, 0, W - x, Hc); }
        else { const fin = Math.min(W, x - d); g.drawImage(c, fin, 0, W - fin, Hc, x, 0, W - fin, Hc); }
        return n;
      };
      img = couper(img);
      if (rem) rem = couper(rem);
      if (o.axe === "v") H = img.height / k; else L = img.width / k;
    } else if (o.t === "gomme") {
      for (const c of [img, rem]) {
        if (!c) continue;
        const g = c.getContext("2d")!;
        g.globalCompositeOperation = "destination-out"; g.lineCap = "round"; g.lineJoin = "round"; g.lineWidth = o.epaisseur * k;
        g.beginPath(); o.pts.map(px).forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
        if (o.pts.length === 1) g.lineTo(px(o.pts[0])[0] + 0.1, px(o.pts[0])[1]);
        g.stroke(); g.globalCompositeOperation = "source-over";
      }
    } else if (o.t === "remplir") {
      if (!rem) rem = toile(img.width, img.height);
      remplir(img, rem, px([o.x, o.y]), o.couleur, o.tolerance);
    }
  }
  // Masque de la couleur principale : la silhouette, sans les zones déjà remplies.
  const masque = toile(img.width, img.height);
  const gm = masque.getContext("2d")!;
  gm.drawImage(img, 0, 0);
  if (rem) { gm.globalCompositeOperation = "destination-out"; gm.drawImage(rem, 0, 0); }
  const url = (c: HTMLCanvasElement) => new Promise<string>((ok) => c.toBlob((b) => ok(URL.createObjectURL(b!)), "image/png"));
  const urls: Record<string, string> = { i: await url(img), m: await url(masque) };
  if (rem) urls.r = await url(rem);
  void H;
  return { image: img, remplissage: rem, masque, urls };
}

/**
 * Pot de peinture : remplit la zone claire connexe autour du point, en multipliant
 * la couleur par la luminosité du dessin (les ombres et plis restent visibles).
 */
function remplir(img: HTMLCanvasElement, rem: HTMLCanvasElement, [x0, y0]: Pt, couleur: string, tolerance: number) {
  const W = img.width, H = img.height;
  const sx = Math.round(x0), sy = Math.round(y0);
  if (sx < 0 || sy < 0 || sx >= W || sy >= H) return;
  const src = img.getContext("2d")!.getImageData(0, 0, W, H).data;
  const lum = (i: number) => (src[i * 4 + 3] < 40 ? -1 : 0.299 * src[i * 4] + 0.587 * src[i * 4 + 1] + 0.114 * src[i * 4 + 2]);
  const seuil = 255 - tolerance;
  if (lum(sy * W + sx) < seuil) return; // clic sur un trait
  const vu = new Uint8Array(W * H);
  const pile = [sy * W + sx];
  vu[sy * W + sx] = 1;
  while (pile.length) {
    const i = pile.pop()!;
    const x = i % W;
    for (const j of [i - 1, i + 1, i - W, i + W]) {
      if (j < 0 || j >= W * H || vu[j]) continue;
      if ((j === i - 1 && x === 0) || (j === i + 1 && x === W - 1)) continue;
      if (lum(j) >= seuil) { vu[j] = 1; pile.push(j); }
    }
  }
  const g = rem.getContext("2d")!;
  const out = g.getImageData(0, 0, W, H);
  const h = couleur.replace("#", "");
  const [r, gg, b] = [0, 2, 4].map((o) => parseInt(h.slice(o, o + 2), 16));
  for (let i = 0; i < W * H; i++) {
    if (!vu[i]) continue;
    const l = Math.max(0, lum(i)) / 255;
    out.data[i * 4] = r * l; out.data[i * 4 + 1] = gg * l; out.data[i * 4 + 2] = b * l; out.data[i * 4 + 3] = 255;
  }
  g.putImageData(out, 0, 0);
}
