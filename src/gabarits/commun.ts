import type { Pt, Trace, Dessin, Mesures } from "../moteur/types";
import { boite, add, mul, sub, norm, perp, lerp } from "../moteur/geom";

/** Points d'une Bézier cubique. */
export function cubique(a: Pt, c1: Pt, c2: Pt, b: Pt, n = 20): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([
      u * u * u * a[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * b[0],
      u * u * u * a[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * b[1],
    ]);
  }
  return out;
}

/**
 * Encolure vue de face : courbe de l'épaule gauche (x = -demiLargeur) à droite,
 * passant par le point le plus bas (0, profondeur). Retourne des points.
 */
export function encolure(demiLargeur: number, profondeur: number, yHaut = 0): Pt[] {
  const g = cubique([-demiLargeur, yHaut], [-demiLargeur, yHaut + profondeur * 0.75], [-demiLargeur * 0.55, yHaut + profondeur], [0, yHaut + profondeur]);
  const d = g.slice(0, -1).reverse().map(([x, y]) => [-x, y] as Pt);
  return [...g, ...d];
}

/** Lit une mesure en mm avec garde-fou. */
export const lire = (m: Mesures, cle: string, defaut: number) => (Number.isFinite(m[cle]) ? m[cle] : defaut);

/** Assemble un dessin et calcule sa boîte englobante à partir de points témoins. */
export function dessin(traces: Trace[], temoins: Pt[]): Dessin {
  return { traces, boite: boite(temoins) };
}

/** Plis fins (lignes grises courtes) le long d'un segment, tournés vers l'intérieur. */
export function plis(a: Pt, b: Pt, longueur: number, nombre: number, cote: 1 | -1): Pt[][] {
  const t = norm(sub(b, a));
  const n = mul(perp(t), cote);
  const out: Pt[][] = [];
  for (let i = 1; i <= nombre; i++) {
    const p = lerp(a, b, i / (nombre + 1));
    const q = add(add(p, mul(n, longueur)), mul(t, longueur * 0.35));
    out.push([p, lerp(p, q, 0.5), q]);
  }
  return out;
}
