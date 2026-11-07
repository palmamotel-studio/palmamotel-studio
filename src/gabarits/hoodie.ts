import { creerHaut, points } from "./haut";
import type { Mesures, Pose } from "../moteur/types";

/**
 * HOODIE classique : capuche avec cordons, poche kangourou, poignets et bas en bord-côte.
 * Construit avec le constructeur commun des hauts (voir haut.ts).
 */
const config = {
  id: "hoodie", nom: "Hoodie", famille: "hauts" as const,
  col: "capuche" as const, ouverture: "aucune" as const, poches: ["kangourou" as const], poignet: "cote" as const, bas: "cote" as const,
};
export const hoodie = creerHaut(config);
export const _interne = { points: (m: Mesures, pose: Pose) => points(m, pose, config) };
