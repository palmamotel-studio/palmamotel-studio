import { modeleImage } from "./modele";
import type { EntreeCatalogue, Gabarit } from "../moteur/types";
import { tshirt } from "./tshirt";
import { hoodie } from "./hoodie";
import { polo, debardeur } from "./hauts3";
import { jogging, short, pantalon, cargo, shortBain } from "./bas";
import { bikiniHaut, bikiniBas, casquette, bob, bonnet, tote, chaussettes } from "./accessoires";
import { crewneck, manchesLongues, hoodieZip, vesteCagoule, coach, bomber, varsity, coupeVent, harrington, jean, track, doudoune, softshell } from "./vague2";

/**
 * CATALOGUE — toutes les pièces prévues.
 * Pour ajouter un vêtement : créer son gabarit (voir tshirt.ts) puis le brancher ici
 * avec `gabarit: monGabarit`. Le moteur et l'interface n'ont rien d'autre à changer.
 */
export const CATALOGUE: EntreeCatalogue[] = [
  // Hauts
  { id: "tshirt", nom: "T-shirt", famille: "hauts", vague: 1, gabarit: tshirt },
  { id: "hoodie", nom: "Hoodie", famille: "hauts", vague: 1, gabarit: hoodie },
  { id: "crewneck", nom: "Sweat col rond", famille: "hauts", vague: 2, gabarit: crewneck },
  { id: "manches_longues", nom: "T-shirt manches longues", famille: "hauts", vague: 2, gabarit: manchesLongues },
  { id: "hoodie_zip", nom: "Hoodie zippé", famille: "hauts", vague: 2, gabarit: hoodieZip },
  { id: "polo", nom: "Polo", famille: "hauts", vague: 3, gabarit: polo },
  { id: "debardeur", nom: "Débardeur", famille: "hauts", vague: 3, gabarit: debardeur },
  // Vestes
  { id: "veste_cagoule", nom: "Veste cagoule zippée", famille: "vestes", vague: 2, gabarit: vesteCagoule },
  { id: "coach", nom: "Coach jacket", famille: "vestes", vague: 2, gabarit: coach },
  { id: "bomber", nom: "Bomber", famille: "vestes", vague: 2, gabarit: bomber },
  { id: "varsity", nom: "Varsity", famille: "vestes", vague: 2, gabarit: varsity },
  { id: "coupe_vent", nom: "Coupe-vent", famille: "vestes", vague: 2, gabarit: coupeVent },
  { id: "harrington", nom: "Harrington", famille: "vestes", vague: 2, gabarit: harrington },
  { id: "jean", nom: "Veste en jean", famille: "vestes", vague: 2, gabarit: jean },
  { id: "track", nom: "Track jacket", famille: "vestes", vague: 2, gabarit: track },
  { id: "doudoune", nom: "Doudoune", famille: "vestes", vague: 2, gabarit: doudoune },
  { id: "softshell", nom: "Softshell zippée", famille: "vestes", vague: 2, gabarit: softshell },
  // Bas
  { id: "jogging", nom: "Jogging", famille: "bas", vague: 3, gabarit: jogging },
  { id: "short", nom: "Short", famille: "bas", vague: 3, gabarit: short },
  { id: "pantalon", nom: "Pantalon droit", famille: "bas", vague: 3, gabarit: pantalon },
  { id: "cargo", nom: "Cargo", famille: "bas", vague: 3, gabarit: cargo },
  // Bain
  { id: "short_bain", nom: "Short de bain", famille: "bain", vague: 3, gabarit: shortBain },
  { id: "bikini_haut", nom: "Bikini (haut)", famille: "bain", vague: 3, gabarit: bikiniHaut },
  { id: "bikini_bas", nom: "Bikini (bas)", famille: "bain", vague: 3, gabarit: bikiniBas },
  // Accessoires
  { id: "casquette", nom: "Casquette", famille: "accessoires", vague: 3, gabarit: casquette },
  { id: "bob", nom: "Bob", famille: "accessoires", vague: 3, gabarit: bob },
  { id: "bonnet", nom: "Bonnet", famille: "accessoires", vague: 3, gabarit: bonnet },
  { id: "tote", nom: "Tote bag", famille: "accessoires", vague: 3, gabarit: tote },
  { id: "chaussettes", nom: "Chaussettes", famille: "accessoires", vague: 3, gabarit: chaussettes },
];

export function gabarit(id: string): Gabarit | undefined {
  if (id === "modele") return modeleImage;
  return CATALOGUE.find((e) => e.id === id)?.gabarit;
}
