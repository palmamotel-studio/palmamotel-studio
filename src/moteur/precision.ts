import type { DefMesure, Niveau } from "./types";

const POIDS: Record<Niveau, number> = { obligatoire: 5, recommande: 3, optionnel: 1 };

/** Une information qui améliore le mock-up si on la renseigne. */
export interface InfoManquante {
  cle: string;
  libelle: string;
  niveau: Niveau;
  poids: number;
  etape: string;
}

/** Champs de fiche hors mesures, comptés dans le score. */
export interface ChampFiche {
  cle: string;
  libelle: string;
  niveau: Niveau;
  rempli: boolean;
  etape: string;
}

/**
 * Score de précision (0–100) : part du poids des informations RÉELLEMENT saisies
 * (une mesure laissée au barème standard ne compte pas comme saisie).
 */
export function scorePrecision(defs: DefMesure[], saisies: Set<string>, champs: ChampFiche[]) {
  const manquantes: InfoManquante[] = [];
  let total = 0, acquis = 0;
  for (const d of defs) {
    const p = POIDS[d.niveau];
    total += p;
    if (saisies.has(d.cle)) acquis += p;
    else manquantes.push({ cle: d.cle, libelle: d.libelle, niveau: d.niveau, poids: p, etape: "mesures" });
  }
  for (const c of champs) {
    const p = POIDS[c.niveau];
    total += p;
    if (c.rempli) acquis += p;
    else manquantes.push({ cle: c.cle, libelle: c.libelle, niveau: c.niveau, poids: p, etape: c.etape });
  }
  manquantes.sort((a, b) => b.poids - a.poids);
  return { score: total ? Math.round((acquis / total) * 100) : 0, manquantes };
}
