import type { Gabarit } from "../moteur/types";

/**
 * MODÈLES DU CATALOGUE (images du pack Opus, stockées dans l'espace privé).
 * Ce pseudo-gabarit porte seulement l'échelle : la largeur réelle du dessin de face.
 * Le dessin lui-même est l'image du modèle (voir etat/calcul.ts → rendreModele).
 */
export const modeleImage: Gabarit = {
  id: "modele",
  nom: "Modèle du catalogue",
  famille: "hauts",
  poseParDefaut: "ecartes",
  poses: ["ecartes"],
  vues: ["face", "dos", "profil"],
  finitions: [],
  mesures: [
    { cle: "largeur_dessin", libelle: "Largeur réelle du dessin", aide: "Largeur totale de la vue de face, d'un bout à l'autre (manches comprises), en taille de référence. Sert à poser les éléments et les zones à la bonne taille.", niveau: "recommande", defautM: 70, gradation: 2.5, min: 5, max: 250 },
  ],
  dessiner: () => ({ traces: [], boite: { x: 0, y: 0, l: 1, h: 1 } }),
  zones: () => [],
};

/** Largeur par défaut selon la famille Opus (cm, vue de face). */
export function largeurParDefaut(famille: string, nomVue: string): number {
  const ecartes = /écartés/.test(nomVue);
  switch (famille) {
    case "hauts": case "vestes": case "nouveautes": return ecartes ? 150 : 75;
    case "bas": return 60;
    default: return 30;
  }
}
