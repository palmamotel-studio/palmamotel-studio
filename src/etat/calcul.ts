import type { Projet } from "./projet";
import type { Taille, Vue } from "../moteur/types";
import { VUES } from "../moteur/types";
import { gabarit } from "../gabarits";
import { mesuresCm, enMm } from "../moteur/tailles";
import { rendre, type Rendu } from "../moteur/rendu";
import { scorePrecision, type ChampFiche } from "../moteur/precision";
import { urlVisuel } from "./visuels";

export function mesuresDe(p: Projet, t: Taille) {
  const g = gabarit(p.gabaritId)!;
  const cm = mesuresCm(g.mesures, p.tableau, t);
  return { g, cm, mm: enMm(cm) };
}

/** Vue du modèle utilisée pour une vue du projet, et sa taille réelle (mm). */
export function vueModele(p: Projet, vue: Vue, t: Taille) {
  const m = p.modele!;
  const i = m.correspondance[vue] ?? m.correspondance.face ?? 0;
  const v = m.vues[Math.min(i, m.vues.length - 1)];
  const face = m.vues[m.correspondance.face ?? 0] ?? v;
  const largeurFace = mesuresDe(p, t).mm.largeur_dessin;
  const k = largeurFace / face.l; // mm par pixel de l'image
  return { v, l: v.l * k, h: v.h * k };
}

function rendreModele(p: Projet, vue: Vue, t: Taille, idUnique: string): Rendu {
  const { v, l, h } = vueModele(p, vue, t);
  const c = p.couleur;
  return rendre(
    { traces: [], boite: { x: -l / 2, y: 0, l, h } },
    {
      couleurs: { principale: c.traitSeul ? null : c.principale, cotes: null, interieur: null, fil: null, accessoires: c.accessoires },
      zones: [], zonesActives: [], retouches: p.retouches[vue] || [], marge: 40, fond: "#ffffff",
      elements: (p.elements || []).filter((e) => e.vue === vue), taille: t, visuel: urlVisuel,
      image: { src: "stockage:catalogue/" + v.chemin, x: -l / 2, y: 0, l, h },
    },
    idUnique,
  );
}

export function rendreProjet(p: Projet, vue: Vue, t: Taille, idUnique: string): Rendu {
  if (p.modele) return rendreModele(p, vue, t, idUnique);
  const { g, mm } = mesuresDe(p, t);
  const pose = g.poses.includes(p.pose) ? p.pose : g.poseParDefaut;
  const d = g.dessiner(mm, vue, pose, p.finitions);
  const c = p.couleur;
  return rendre(
    d,
    {
      couleurs: {
        principale: c.traitSeul ? null : c.principale,
        cotes: c.traitSeul ? null : c.cotes,
        interieur: c.traitSeul ? null : c.interieur,
        fil: c.traitSeul ? null : c.fil,
        accessoires: c.accessoires,
      },
      zones: g.zones(mm, vue),
      zonesActives: p.zonesActives,
      retouches: p.retouches[vue] || [],
      marge: 40,
      fond: "#ffffff",
      finitions: p.finitions,
      effet: p.matiere.effet,
      grammage: p.matiere.grammage,
      elements: (p.elements || []).filter((e) => e.vue === vue),
      taille: t,
      visuel: urlVisuel,
    },
    idUnique,
  );
}

/** Score de précision et infos manquantes du projet (taille de référence). */
export function precisionProjet(p: Projet) {
  const g = gabarit(p.gabaritId)!;
  const saisies = new Set(Object.keys(p.tableau[p.tailleRef] || {}));
  const champs: ChampFiche[] = [
    { cle: "nom", libelle: "Nom du modèle", niveau: "obligatoire", rempli: !/sans nom$/i.test(p.nom.trim()) && !!p.nom.trim(), etape: "piece" },
    { cle: "reference", libelle: "Référence interne", niveau: "recommande", rempli: !!p.reference.trim(), etape: "piece" },
    { cle: "collection", libelle: "Collection / saison", niveau: "optionnel", rempli: !!p.collection.trim(), etape: "piece" },
    { cle: "matiere", libelle: "Type de matière", niveau: "recommande", rempli: !!p.matiere.type, etape: "matiere" },
    { cle: "composition", libelle: "Composition", niveau: "recommande", rempli: !!p.matiere.composition.trim(), etape: "matiere" },
    { cle: "grammage", libelle: "Grammage (g/m²)", niveau: "recommande", rempli: !!p.matiere.grammage, etape: "matiere" },
    { cle: "pantone", libelle: "Référence Pantone", niveau: "optionnel", rempli: p.couleur.traitSeul || !!p.couleur.pantone.trim(), etape: "matiere" },
  ];
  return scorePrecision(g.mesures, saisies, champs);
}

/** Vues disponibles pour un projet (un modèle du catalogue n'a que les vues associées). */
export function vuesDe(p: Projet): Vue[] {
  if (p.modele) return (["face", "dos", "profil"] as Vue[]).filter((v) => p.modele!.correspondance[v] !== null);
  return gabarit(p.gabaritId)?.vues ?? VUES;
}
