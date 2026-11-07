import { describe, it, expect } from "vitest";
import { projetDepuisIA, type ResultatIA } from "../../etat/generation";

const base: ResultatIA = {
  gabaritId: "hoodie_zip", nom: "Hoodie Vacancy", cible: "unisexe", coupe: "oversize", tailleRef: "M",
  mesures: [{ cle: "demi_poitrine", cm: 64 }, { cle: "inconnue", cm: 10 }, { cle: "manche", cm: 400 }],
  couleur: { traitSeul: false, hex: "#e8a0b4", pantone: "13-1520 TCX" },
  matiere: { type: "french terry", composition: "100 % coton", grammage: 400 },
  zones: ["coeur", "dos", "zone_inexistante"], notes: "Logo brodé au cœur.", ecarts: "",
};

describe("proposition du générateur → projet", () => {
  it("garde uniquement les mesures valides de la pièce choisie", () => {
    const p = projetDepuisIA(base, 3, "desc");
    expect(p.tableau.M).toEqual({ demi_poitrine: 64 });
  });
  it("reprend couleur, matière et zones existantes", () => {
    const p = projetDepuisIA(base, 3, "desc");
    expect(p.couleur).toMatchObject({ traitSeul: false, principale: "#E8A0B4", pantone: "13-1520 TCX" });
    expect(p.matiere.grammage).toBe(400);
    expect(p.zonesActives).toEqual(["coeur", "dos"]);
    expect(p.reference).toBe(`PM-${String(new Date().getFullYear()).slice(2)}-003`);
  });
  it("trait seul et sans mesures : barème standard", () => {
    const p = projetDepuisIA({ ...base, mesures: [], couleur: { traitSeul: true, hex: "", pantone: "" } }, 1, "");
    expect(p.tableau).toEqual({});
    expect(p.couleur.traitSeul).toBe(true);
  });
});
