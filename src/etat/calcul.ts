import type { Projet } from "./projet";
import type { Taille, Vue } from "../moteur/types";
import { gabarit } from "../gabarits";
import { mesuresCm, enMm } from "../moteur/tailles";
import { rendre, type Rendu } from "../moteur/rendu";
import { scorePrecision, type ChampFiche } from "../moteur/precision";

export function mesuresDe(p: Projet, t: Taille) {
  const g = gabarit(p.gabaritId)!;
  const cm = mesuresCm(g.mesures, p.tableau, t);
  return { g, cm, mm: enMm(cm) };
}

export function rendreProjet(p: Projet, vue: Vue, t: Taille, idUnique: string): Rendu {
  const { g, mm } = mesuresDe(p, t);
  const pose = g.poses.includes(p.pose) ? p.pose : g.poseParDefaut;
  const d = g.dessiner(mm, vue, pose);
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
