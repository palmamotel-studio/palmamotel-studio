/**
 * Types du moteur de vêtements.
 *
 * Unité unique : le MILLIMÈTRE. Toute la géométrie est calculée en mm à partir
 * des mesures réelles ; la conversion en pixels n'a lieu qu'au rendu/export
 * (voir echelle.ts).
 */

export type Vue = "face" | "dos";
export const VUES: Vue[] = ["face", "dos"];
export const NOMS_VUES: Record<Vue, string> = { face: "Face", dos: "Dos" };

export type Taille = "XS" | "S" | "M" | "L" | "XL";
export const TAILLES: Taille[] = ["XS", "S", "M", "L", "XL"];

/** Pose des bras sur le dessin à plat. */
export type Pose = "ecartes" | "le_long";

export type Niveau = "obligatoire" | "recommande" | "optionnel";

/** Définition d'une mesure saisie par l'utilisateur (en cm dans l'interface). */
export interface DefMesure {
  cle: string;
  libelle: string;
  /** Comment la prendre, en une phrase. */
  aide: string;
  niveau: Niveau;
  /** Valeur en taille M, en cm. */
  defautM: number;
  /** Écart entre deux tailles consécutives (gradation), en cm. */
  gradation: number;
  min: number;
  max: number;
  /** Segment de cote à dessiner pour montrer où mesurer (en mm, repère du vêtement). */
  cote?: (m: Mesures, vue: Vue) => Cote | null;
}

export interface Cote {
  a: Pt;
  b: Pt;
  /** Décalage de la ligne de cote, perpendiculaire au segment (mm). */
  decalage?: number;
}

export type Pt = [number, number];
/** Mesures en MILLIMÈTRES, indexées par clé. */
export type Mesures = Record<string, number>;

/** Rôle d'un tracé : détermine son calque et son style. */
export type Role =
  | "piece"      // surface de tissu : remplie de la couleur + contour épais
  | "cote"       // bord-côte : rempli + rayures fines
  | "interieur"  // intérieur visible (capuche, encolure dos) : gris clair
  | "couture"    // ligne de couture fine continue
  | "surpiqure"  // surpiqûre en pointillés
  | "pli"        // pli fin, gris
  | "ombre"      // aplat gris d'ombre
  | "accessoire"; // cordons, embouts, œillets

export interface Trace {
  role: Role;
  d: string;
  /** Rayures des bords-côtes : direction des rayures (radians). */
  angleRayures?: number;
  /** Nom lisible, utilisé pour nommer les calques et les sous-calques. */
  nom?: string;
}

/** Une pièce dessinée = une surface + ses détails, dessinés dans l'ordre. */
export interface Dessin {
  /** Tracés dans l'ordre de superposition (du fond vers l'avant). */
  traces: Trace[];
  /** Boîte englobante en mm (sert au cadrage et à l'export à l'échelle). */
  boite: { x: number; y: number; l: number; h: number };
}

export interface ZoneImpression {
  id: string;
  nom: string;
  vue: Vue;
  /** Rectangle en mm (centre x, haut y, largeur, hauteur). */
  cx: number;
  y: number;
  l: number;
  h: number;
}

export interface Alerte {
  cle?: string;
  message: string;
}

export type Famille = "hauts" | "vestes" | "bas" | "bain" | "accessoires";
export const NOMS_FAMILLES: Record<Famille, string> = {
  hauts: "Hauts",
  vestes: "Vestes",
  bas: "Bas",
  bain: "Bain",
  accessoires: "Accessoires",
};

/** Finitions de confection (étape 4). */
export interface Finitions {
  piqure: "simple" | "double";
  cotes: "1x1" | "2x2";
  bas: "droit" | "arrondi" | "fentes";
  bandeProprete: boolean;
  cordon: "rond" | "plat";
  embout: "metal" | "plastique" | "silicone" | "noeud";
  oeillet: "metal" | "brode";
  zip: "metal" | "plastique" | "invisible";
  couleurZip: string;
}
export const FINITIONS_DEFAUT: Finitions = {
  piqure: "simple", cotes: "1x1", bas: "droit", bandeProprete: true, cordon: "rond", embout: "metal", oeillet: "metal", zip: "metal", couleurZip: "#1b1b1b",
};

/** Un gabarit décrit entièrement un type de vêtement. Le moteur ne connaît rien d'autre. */
export interface Gabarit {
  id: string;
  nom: string;
  famille: Famille;
  mesures: DefMesure[];
  /** Pose par défaut des bras. */
  poseParDefaut: Pose;
  /** Poses proposées (une seule = pas de choix affiché). */
  poses: Pose[];
  dessiner: (m: Mesures, vue: Vue, pose: Pose, f?: Finitions) => Dessin;
  /** Finitions proposées pour cette pièce (étape 4). */
  finitions: (keyof Finitions)[];
  zones: (m: Mesures, vue: Vue) => ZoneImpression[];
  /** Contrôles de cohérence entre mesures. */
  controles?: (m: Mesures) => Alerte[];
  /** Poignées de retouche directe : glisser modifie une mesure. */
  poignees?: (m: Mesures, vue: Vue, pose: Pose) => Poignee[];
}

/** Une poignée posée sur le dessin : la déplacer le long de `axe` change la mesure `cle`. */
export interface Poignee {
  cle: string;
  pos: Pt;
  /** Vecteur unitaire : déplacer de 1 mm le long de l'axe = +facteur mm sur la mesure. */
  axe: Pt;
  facteur: number;
}

/** Entrée du catalogue (y compris les pièces pas encore disponibles). */
export interface EntreeCatalogue {
  id: string;
  nom: string;
  famille: Famille;
  vague: number;
  gabarit?: Gabarit;
}
