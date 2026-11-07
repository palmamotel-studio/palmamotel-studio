import { creerHaut } from "./haut";

/**
 * VAGUE 2 — hauts à manches longues et vestes, décrits par configuration.
 * Valeurs par défaut en taille M (cm), barème standard unisexe.
 */
export const crewneck = creerHaut({
  id: "crewneck", nom: "Sweat col rond", famille: "hauts",
  col: "rond", ouverture: "aucune", poches: [], poignet: "cote", bas: "cote",
  defauts: { demi_poitrine: 58, longueur: 69, epaules: 54, manche: 62, largeur_encolure: 19 },
});

export const manchesLongues = creerHaut({
  id: "manches_longues", nom: "T-shirt manches longues", famille: "hauts",
  col: "rond", ouverture: "aucune", poches: [], poignet: "cote", bas: "ourlet",
  defauts: { demi_poitrine: 54, longueur: 72, epaules: 46, manche: 63, emmanchure: 23, largeur_manche: 19, poignet: 8, hauteur_poignet: 5, largeur_bas: 54, largeur_encolure: 18, prof_encolure_devant: 9 },
});

export const hoodieZip = creerHaut({
  id: "hoodie_zip", nom: "Hoodie zippé", famille: "hauts",
  col: "capuche", ouverture: "zip", poches: ["kangourou"], poignet: "cote", bas: "cote",
});

export const vesteCagoule = creerHaut({
  id: "veste_cagoule", nom: "Veste cagoule zippée", famille: "vestes",
  col: "cagoule", ouverture: "zip", poches: ["kangourou"], poignet: "cote", bas: "cote",
  details: { froncesManche: true },
  defauts: { demi_poitrine: 62, longueur: 62, epaules: 58, manche: 64, largeur_manche: 26, hauteur_capuche: 38, largeur_capuche: 27 },
});

export const coach = creerHaut({
  id: "coach", nom: "Coach jacket", famille: "vestes",
  col: "chemise", ouverture: "pressions", poches: ["passepoil"], poignet: "ourlet", bas: "cordon",
  defauts: { demi_poitrine: 62, longueur: 70, epaules: 52, manche: 63, largeur_bas: 62, poignet: 14 },
});

export const bomber = creerHaut({
  id: "bomber", nom: "Bomber", famille: "vestes",
  col: "bomber", ouverture: "zip", poches: ["passepoil", "manche_zip"], poignet: "cote", bas: "cote",
  details: { froncesManche: true },
  defauts: { demi_poitrine: 60, longueur: 66, epaules: 50, manche: 64, largeur_bas: 50 },
});

export const varsity = creerHaut({
  id: "varsity", nom: "Varsity", famille: "vestes",
  col: "bomber", ouverture: "pressions", poches: ["passepoil"], poignet: "cote", bas: "cote",
  defauts: { demi_poitrine: 61, longueur: 68, epaules: 52, manche: 64, largeur_bas: 50, hauteur_col: 4.5 },
});

export const coupeVent = creerHaut({
  id: "coupe_vent", nom: "Coupe-vent", famille: "vestes",
  col: "capuche", ouverture: "zip", poches: ["laterales_zip"], poignet: "elastique", bas: "cordon",
  defauts: { demi_poitrine: 62, longueur: 72, epaules: 52, manche: 64, largeur_bas: 60, poignet: 11 },
});

export const harrington = creerHaut({
  id: "harrington", nom: "Harrington", famille: "vestes",
  col: "chemise", ouverture: "zip", poches: ["rabat"], poignet: "cote", bas: "cote",
  defauts: { demi_poitrine: 59, longueur: 67, epaules: 48, manche: 64, largeur_bas: 52 },
});

export const jean = creerHaut({
  id: "jean", nom: "Veste en jean", famille: "vestes",
  col: "chemise", ouverture: "boutons", poches: ["poitrine_rabat"], poignet: "bouton", bas: "ceinture",
  details: { empiecement: true },
  defauts: { demi_poitrine: 58, longueur: 64, epaules: 48, manche: 63, largeur_bas: 54, poignet: 12, largeur_manche: 21 },
});

export const track = creerHaut({
  id: "track", nom: "Track jacket", famille: "vestes",
  col: "montant", ouverture: "zip", poches: ["laterales_zip"], poignet: "cote", bas: "cote",
  details: { bandes: true },
  defauts: { demi_poitrine: 56, longueur: 68, epaules: 48, manche: 64, largeur_bas: 50, largeur_manche: 20 },
});

export const doudoune = creerHaut({
  id: "doudoune", nom: "Doudoune", famille: "vestes",
  col: "montant", ouverture: "zip", poches: ["laterales_zip"], poignet: "elastique", bas: "ourlet",
  details: { matelassage: true },
  defauts: { demi_poitrine: 64, longueur: 70, epaules: 54, manche: 66, largeur_manche: 27, largeur_bas: 62, poignet: 12, hauteur_col: 8 },
});

export const softshell = creerHaut({
  id: "softshell", nom: "Softshell zippée", famille: "vestes",
  col: "montant", ouverture: "zip", poches: ["laterales_zip"], poignet: "ourlet", bas: "cordon",
  defauts: { demi_poitrine: 58, longueur: 72, epaules: 48, manche: 65, largeur_bas: 57, poignet: 12 },
});
