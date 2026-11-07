import type { Pt } from "./types";

/* Petites opérations vectorielles (mm). */
export const add = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]];
export const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
export const mul = (a: Pt, k: number): Pt => [a[0] * k, a[1] * k];
export const len = (a: Pt): number => Math.hypot(a[0], a[1]);
export const norm = (a: Pt): Pt => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l];
};
export const lerp = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
export const dist = (a: Pt, b: Pt) => len(sub(b, a));
/** Vecteur unitaire d'angle `deg` (0° = vers la droite, 90° = vers le bas). */
export const dir = (deg: number): Pt => [Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180)];
/** Perpendiculaire (rotation +90°). */
export const perp = (a: Pt): Pt => [-a[1], a[0]];
/** Miroir gauche/droite par rapport à l'axe central x = 0. */
export const miroir = (p: Pt): Pt => [-p[0], p[1]];

const f = (n: number) => (Math.round(n * 100) / 100).toString();
const P = (p: Pt) => `${f(p[0])} ${f(p[1])}`;

/** Construction de chemins SVG lisible. */
export class Chemin {
  private parts: string[] = [];
  m(p: Pt) { this.parts.push(`M ${P(p)}`); return this; }
  l(...ps: Pt[]) { ps.forEach((p) => this.parts.push(`L ${P(p)}`)); return this; }
  q(c: Pt, p: Pt) { this.parts.push(`Q ${P(c)} ${P(p)}`); return this; }
  c(c1: Pt, c2: Pt, p: Pt) { this.parts.push(`C ${P(c1)} ${P(c2)} ${P(p)}`); return this; }
  z() { this.parts.push("Z"); return this; }
  toString() { return this.parts.join(" "); }
}

/** Polyligne. */
export function ligne(pts: Pt[], ferme = false): string {
  const c = new Chemin().m(pts[0]);
  c.l(...pts.slice(1));
  if (ferme) c.z();
  return c.toString();
}

/**
 * Courbe lisse passant par tous les points (Catmull-Rom convertie en Bézier).
 * `tension` 0..1 : 0 = très arrondi.
 */
export function lisse(pts: Pt[], ferme = false, tension = 0): string {
  if (pts.length < 3) return ligne(pts, ferme);
  const n = pts.length;
  const get = (i: number) => (ferme ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  const k = (1 - tension) / 6;
  const c = new Chemin().m(pts[0]);
  const segs = ferme ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k];
    c.c(c1, c2, p2);
  }
  if (ferme) c.z();
  return c.toString();
}

/** Points d'une Bézier quadratique (échantillonnés). */
export function quad(a: Pt, ctrl: Pt, b: Pt, n = 16): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    out.push([
      (1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * ctrl[0] + t * t * b[0],
      (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * ctrl[1] + t * t * b[1],
    ]);
  }
  return out;
}

/**
 * Décale une polyligne de `d` mm (positif = à gauche du sens de parcours).
 * Sert aux surpiqûres parallèles aux bords.
 */
export function decaler(pts: Pt[], d: number): Pt[] {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const t = norm(sub(b, a));
    const n = perp(t);
    return add(p, mul(n, -d));
  });
}

/** Boîte englobante d'une liste de points. */
export function boite(pts: Pt[]) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  return { x: x0, y: y0, l: x1 - x0, h: y1 - y0 };
}

/** Rayures parallèles pour un bord-côte, entre deux segments (bord A et bord B). */
export function rayures(a0: Pt, a1: Pt, b0: Pt, b1: Pt, pas = 3.5): string {
  const n = Math.max(2, Math.round(dist(a0, a1) / pas));
  const c = new Chemin();
  for (let i = 1; i < n; i++) {
    const t = i / n;
    c.m(lerp(a0, a1, t)).l(lerp(b0, b1, t));
  }
  return c.toString();
}
