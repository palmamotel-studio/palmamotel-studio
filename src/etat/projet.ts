import type { Pose, Taille, Vue, Finitions } from "../moteur/types";
import { FINITIONS_DEFAUT } from "../moteur/types";
import type { Element } from "../moteur/elements";
import type { TableauTailles } from "../moteur/tailles";
import type { Retouche } from "../moteur/rendu";
import { gabarit } from "../gabarits";

/** Un projet = un mock-up et tout ce qu'il faut pour le régénérer. */
export interface Projet {
  version: 1;
  id: string;
  // 5.1 Identification
  nom: string;
  reference: string;
  collection: string;
  cible: "homme" | "femme" | "unisexe" | "enfant";
  gabaritId: string;
  tailleRef: Taille;
  // 5.2 Coupe
  coupe: "slim" | "regular" | "relaxed" | "oversize" | "boxy" | "cropped";
  epaule: "montee" | "tombante" | "raglan";
  // 5.3 Mesures saisies (cm), par taille
  tableau: TableauTailles;
  // 5.4 Matière
  matiere: { type: string; composition: string; grammage: number | null; effet: string };
  // 5.5 Couleur
  couleur: {
    traitSeul: boolean;
    principale: string;
    pantone: string;
    cotes: string | null;
    interieur: string | null;
    fil: string | null;
    accessoires: string;
  };
  pose: Pose;
  // 5.6 Finitions
  finitions: Finitions;
  // 6. Éléments posés (étiquettes, patchs…)
  elements: Element[];
  zonesActives: string[];
  retouches: Record<Vue, Retouche[]>;
  notes: string;
}

export const nouvelId = () =>
  (crypto as any).randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx".replace(/x/g, () => ((Math.random() * 16) | 0).toString(16));

export function nouveauProjet(gabaritId: string, numero: number): Projet {
  const g = gabarit(gabaritId)!;
  const an = String(new Date().getFullYear()).slice(2);
  return {
    version: 1,
    id: nouvelId(),
    nom: `${g.nom} sans nom`,
    reference: `PM-${an}-${String(numero).padStart(3, "0")}`,
    collection: "",
    cible: "unisexe",
    gabaritId,
    tailleRef: "M",
    coupe: "regular",
    epaule: gabaritId === "hoodie" ? "tombante" : "montee",
    tableau: {},
    matiere: { type: gabaritId === "hoodie" ? "french terry" : "jersey", composition: "", grammage: null, effet: "uni" },
    couleur: { traitSeul: true, principale: "#ECE2CC", pantone: "", cotes: null, interieur: null, fil: null, accessoires: "#ffffff" },
    pose: g.poseParDefaut,
    finitions: { ...FINITIONS_DEFAUT },
    elements: [],
    zonesActives: [],
    retouches: { face: [], dos: [] },
    notes: "",
  };
}

/** Relit un projet venant de la base ou d'un fichier .json, en complétant les champs manquants. */
export function normaliser(brut: any): Projet | null {
  if (!brut || typeof brut !== "object" || !gabarit(brut.gabaritId)) return null;
  const base = nouveauProjet(brut.gabaritId, 1);
  return {
    ...base,
    ...brut,
    matiere: { ...base.matiere, ...(brut.matiere || {}) },
    couleur: { ...base.couleur, ...(brut.couleur || {}) },
    retouches: { face: brut.retouches?.face || [], dos: brut.retouches?.dos || [] },
    finitions: { ...base.finitions, ...(brut.finitions || {}) },
    elements: Array.isArray(brut.elements) ? brut.elements : [],
    tableau: brut.tableau || {},
    zonesActives: Array.isArray(brut.zonesActives) ? brut.zonesActives : [],
  };
}

export const MATIERES = ["jersey", "interlock", "french terry", "fleece (molleton gratté)", "piqué", "côte", "nylon", "denim", "autre"];
export const EFFETS = ["uni", "chiné", "garment dye", "délavé", "acid wash"];
export const COUPES: Projet["coupe"][] = ["slim", "regular", "relaxed", "oversize", "boxy", "cropped"];
