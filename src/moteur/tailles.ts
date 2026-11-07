import type { DefMesure, Mesures, Taille } from "./types";
import { TAILLES } from "./types";

/**
 * Gradation : on part de la taille M et on applique l'écart de taille
 * (défini par mesure) autant de fois qu'il y a de tailles d'écart.
 * Ex. demi-poitrine M = 54 cm, gradation 2,5 cm → XS = 49, S = 51,5, L = 56,5, XL = 59.
 */
export function ecartDepuisM(t: Taille): number {
  return TAILLES.indexOf(t) - TAILLES.indexOf("M");
}

/** Valeur standard (cm) d'une mesure pour une taille donnée. */
export function valeurStandard(def: DefMesure, t: Taille): number {
  return arrondi(def.defautM + def.gradation * ecartDepuisM(t));
}

export const arrondi = (n: number, pas = 0.1) => Math.round(n / pas) * pas;

/**
 * Tableau de tailles d'un projet : valeurs en cm saisies par l'utilisateur.
 * Une valeur absente = valeur standard (barème).
 */
export type TableauTailles = Partial<Record<Taille, Record<string, number>>>;

/** Mesures (cm) effectives d'une taille : saisie si présente, sinon gradation depuis la M saisie, sinon barème. */
export function mesuresCm(defs: DefMesure[], tableau: TableauTailles, t: Taille): Record<string, number> {
  const out: Record<string, number> = {};
  for (const d of defs) {
    const saisie = tableau[t]?.[d.cle];
    if (saisie !== undefined) { out[d.cle] = saisie; continue; }
    // Si la M a été saisie, on grade à partir d'elle (garde vos proportions).
    const m = tableau.M?.[d.cle];
    out[d.cle] = m !== undefined ? arrondi(m + d.gradation * ecartDepuisM(t)) : valeurStandard(d, t);
  }
  return out;
}

/** Conversion cm → mm pour le moteur. */
export function enMm(cm: Record<string, number>): Mesures {
  const out: Mesures = {};
  for (const k in cm) out[k] = cm[k] * 10;
  return out;
}
