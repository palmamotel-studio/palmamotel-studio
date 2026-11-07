/**
 * Échelle d'export : à `dpi` points par pouce, 1 mm = dpi / 25,4 pixels.
 * Un logo de 10 cm posé dans Procreate sur un export 300 DPI fait 1181 px :
 * il correspond donc exactement à 10 cm sur le vêtement.
 */
export const MM_PAR_POUCE = 25.4;

export function pxParMm(dpi: number): number {
  return dpi / MM_PAR_POUCE;
}

export function mmEnPx(mm: number, dpi: number): number {
  return Math.round(mm * pxParMm(dpi));
}

/** Taille en pixels d'une toile couvrant `lMm` × `hMm` avec une marge (mm) autour. */
export function tailleToile(lMm: number, hMm: number, dpi: number, margeMm = 40) {
  return { l: mmEnPx(lMm + 2 * margeMm, dpi), h: mmEnPx(hMm + 2 * margeMm, dpi) };
}

/**
 * Limites Procreate. Procreate réduit le nombre de calques quand la toile grandit ;
 * la valeur exacte dépend de la mémoire de l'iPad. Valeurs prudentes pour un
 * iPad Air M2 (8 Go) — à recalibrer après un essai réel.
 */
export const PROCREATE = {
  coteMaxPx: 16384,
  /** Estimation : calques disponibles ≈ budget / (l × h). */
  budgetPixels: 8192 * 8192 * 12,
};

export function calquesProcreateEstimes(lPx: number, hPx: number): number {
  return Math.max(1, Math.floor(PROCREATE.budgetPixels / (lPx * hPx)));
}
