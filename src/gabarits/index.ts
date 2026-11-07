import type { EntreeCatalogue, Gabarit } from "../moteur/types";
import { tshirt } from "./tshirt";
import { hoodie } from "./hoodie";

/**
 * CATALOGUE — toutes les pièces prévues.
 * Pour ajouter un vêtement : créer son gabarit (voir tshirt.ts) puis le brancher ici
 * avec `gabarit: monGabarit`. Le moteur et l'interface n'ont rien d'autre à changer.
 */
export const CATALOGUE: EntreeCatalogue[] = [
  // Hauts
  { id: "tshirt", nom: "T-shirt", famille: "hauts", vague: 1, gabarit: tshirt },
  { id: "hoodie", nom: "Hoodie", famille: "hauts", vague: 1, gabarit: hoodie },
  { id: "crewneck", nom: "Sweat col rond", famille: "hauts", vague: 2 },
  { id: "manches_longues", nom: "T-shirt manches longues", famille: "hauts", vague: 2 },
  { id: "hoodie_zip", nom: "Hoodie zippé", famille: "hauts", vague: 2 },
  { id: "polo", nom: "Polo", famille: "hauts", vague: 3 },
  { id: "debardeur", nom: "Débardeur", famille: "hauts", vague: 3 },
  // Vestes
  { id: "veste_cagoule", nom: "Veste cagoule zippée", famille: "vestes", vague: 2 },
  { id: "coach", nom: "Coach jacket", famille: "vestes", vague: 2 },
  { id: "bomber", nom: "Bomber", famille: "vestes", vague: 2 },
  { id: "varsity", nom: "Varsity", famille: "vestes", vague: 2 },
  { id: "coupe_vent", nom: "Coupe-vent", famille: "vestes", vague: 2 },
  { id: "harrington", nom: "Harrington", famille: "vestes", vague: 2 },
  { id: "jean", nom: "Veste en jean", famille: "vestes", vague: 2 },
  { id: "track", nom: "Track jacket", famille: "vestes", vague: 2 },
  { id: "doudoune", nom: "Doudoune", famille: "vestes", vague: 2 },
  { id: "softshell", nom: "Softshell zippée", famille: "vestes", vague: 2 },
  // Bas
  { id: "jogging", nom: "Jogging", famille: "bas", vague: 3 },
  { id: "short", nom: "Short", famille: "bas", vague: 3 },
  { id: "pantalon", nom: "Pantalon droit", famille: "bas", vague: 3 },
  { id: "cargo", nom: "Cargo", famille: "bas", vague: 3 },
  // Bain
  { id: "short_bain", nom: "Short de bain", famille: "bain", vague: 3 },
  { id: "bikini_haut", nom: "Bikini (haut)", famille: "bain", vague: 3 },
  { id: "bikini_bas", nom: "Bikini (bas)", famille: "bain", vague: 3 },
  // Accessoires
  { id: "casquette", nom: "Casquette", famille: "accessoires", vague: 3 },
  { id: "bob", nom: "Bob", famille: "accessoires", vague: 3 },
  { id: "bonnet", nom: "Bonnet", famille: "accessoires", vague: 3 },
  { id: "tote", nom: "Tote bag", famille: "accessoires", vague: 3 },
  { id: "chaussettes", nom: "Chaussettes", famille: "accessoires", vague: 3 },
];

export function gabarit(id: string): Gabarit | undefined {
  return CATALOGUE.find((e) => e.id === id)?.gabarit;
}
