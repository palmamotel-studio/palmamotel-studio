import { create } from "zustand";
import { produce } from "immer";
import type { Projet } from "./projet";
import type { Taille, Vue } from "../moteur/types";

export type Etape = "piece" | "mesures" | "matiere" | "finitions" | "elements" | "retouches" | "export";
export const ETAPES: { id: Etape; nom: string }[] = [
  { id: "piece", nom: "Pièce" },
  { id: "mesures", nom: "Tailles & mesures" },
  { id: "matiere", nom: "Matière & couleur" },
  { id: "finitions", nom: "Finitions" },
  { id: "elements", nom: "Éléments" },
  { id: "retouches", nom: "Retouches" },
  { id: "export", nom: "Export" },
];

interface EtatEditeur {
  projet: Projet | null;
  passe: Projet[];
  futur: Projet[];
  etape: Etape;
  vue: Vue;
  taille: Taille;
  /** Mesure survolée/en cours de saisie : sa cote s'affiche sur le dessin. */
  mesureActive: string | null;
  modifie: boolean;
  ouvrir: (p: Projet) => void;
  fermer: () => void;
  /** Modifie le projet (avec historique pour annuler/rétablir). */
  modifier: (f: (p: Projet) => void, regrouper?: string) => void;
  annuler: () => void;
  retablir: () => void;
  remplacerDepuisDistant: (p: Projet) => void;
  marquerEnregistre: () => void;
  set: (e: Partial<Pick<EtatEditeur, "etape" | "vue" | "taille" | "mesureActive">>) => void;
}

let dernierGroupe: { cle: string; t: number } | null = null;

export const useEditeur = create<EtatEditeur>((set, get) => ({
  projet: null,
  passe: [],
  futur: [],
  etape: "piece",
  vue: "face",
  taille: "M",
  mesureActive: null,
  modifie: false,
  ouvrir: (p) => set({ projet: p, passe: [], futur: [], etape: "piece", vue: "face", taille: p.tailleRef, modifie: false }),
  fermer: () => set({ projet: null, passe: [], futur: [] }),
  modifier: (f, regrouper) => {
    const { projet, passe } = get();
    if (!projet) return;
    const suivant = produce(projet, f);
    if (suivant === projet) return;
    // Les modifications rapides d'un même champ (glisser, frappe) ne font qu'une étape d'annulation.
    const now = Date.now();
    const fusion = regrouper && dernierGroupe && dernierGroupe.cle === regrouper && now - dernierGroupe.t < 800;
    dernierGroupe = regrouper ? { cle: regrouper, t: now } : null;
    set({ projet: suivant, passe: fusion ? passe : [...passe, projet], futur: [], modifie: true });
  },
  annuler: () => {
    const { projet, passe, futur } = get();
    if (!projet || !passe.length) return;
    set({ projet: passe[passe.length - 1], passe: passe.slice(0, -1), futur: [projet, ...futur], modifie: true });
  },
  retablir: () => {
    const { projet, passe, futur } = get();
    if (!projet || !futur.length) return;
    set({ projet: futur[0], passe: [...passe, projet], futur: futur.slice(1), modifie: true });
  },
  remplacerDepuisDistant: (p) => set({ projet: p, modifie: false }),
  marquerEnregistre: () => set({ modifie: false }),
  set: (e) => set(e),
}));
