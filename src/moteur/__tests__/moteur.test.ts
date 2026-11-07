import { describe, it, expect } from "vitest";
import { pxParMm, mmEnPx, tailleToile } from "../echelle";
import { valeurStandard, mesuresCm, enMm } from "../tailles";
import { scorePrecision } from "../precision";
import { tshirt, _interne as tsh } from "../../gabarits/tshirt";
import { hoodie, _interne as hoo } from "../../gabarits/hoodie";
import { CATALOGUE } from "../../gabarits";
import { TAILLES, VUES } from "../types";
import { rendre } from "../rendu";

const def = (cle: string) => tshirt.mesures.find((d) => d.cle === cle)!;

describe("échelle d'export", () => {
  it("300 DPI : 10 cm = 1181 px", () => {
    expect(mmEnPx(100, 300)).toBe(1181);
    expect(pxParMm(300)).toBeCloseTo(11.811, 3);
  });
  it("la toile ajoute la marge des deux côtés", () => {
    expect(tailleToile(500, 700, 150, 40)).toEqual({ l: mmEnPx(580, 150), h: mmEnPx(780, 150) });
  });
});

describe("gradation des tailles", () => {
  it("applique l'écart de taille depuis la M", () => {
    const d = def("demi_poitrine");
    expect(valeurStandard(d, "M")).toBe(54);
    expect(valeurStandard(d, "XS")).toBe(49);
    expect(valeurStandard(d, "XL")).toBe(59);
  });
  it("grade à partir de la M saisie par l'utilisateur", () => {
    const cm = mesuresCm(tshirt.mesures, { M: { demi_poitrine: 60 } }, "L");
    expect(cm.demi_poitrine).toBe(62.5);
  });
  it("une valeur saisie pour une taille l'emporte", () => {
    const cm = mesuresCm(tshirt.mesures, { M: { longueur: 70 }, L: { longueur: 80 } }, "L");
    expect(cm.longueur).toBe(80);
  });
});

describe("mesures → géométrie (T-shirt)", () => {
  const mm = enMm(mesuresCm(tshirt.mesures, {}, "M"));
  const p = tsh.points(mm, "ecartes");
  it("la largeur à plat sous l'emmanchure vaut le demi-tour de poitrine", () => {
    expect(p.UA[0] * 2).toBeCloseTo(540, 5);
  });
  it("la longueur totale va du point haut d'épaule au bas", () => {
    expect(p.L).toBe(720);
    expect(p.HPS[1]).toBe(0);
  });
  it("la manche mesure exactement la longueur saisie", () => {
    expect(Math.hypot(p.SEo[0] - p.SP[0], p.SEo[1] - p.SP[1])).toBeCloseTo(210, 5);
  });
  it("l'emmanchure (en droite) vaut la mesure saisie", () => {
    expect(Math.hypot(p.UA[0] - p.SP[0], p.UA[1] - p.SP[1])).toBeCloseTo(230, 5);
  });
  it("changer la poitrine change vraiment la silhouette", () => {
    const large = tsh.points({ ...mm, demi_poitrine: 640 }, "ecartes");
    expect(large.UA[0] - p.UA[0]).toBeCloseTo(50, 5);
  });
  it("la boîte du dessin couvre toute la longueur", () => {
    const d = tshirt.dessiner(mm, "face", "ecartes");
    expect(d.boite.h).toBeGreaterThanOrEqual(720);
  });
});

describe("Hoodie", () => {
  const mm = enMm(mesuresCm(hoodie.mesures, {}, "M"));
  it("le poignet a la largeur saisie", () => {
    const p = hoo.points(mm, "ecartes");
    expect(Math.hypot(p.E[0] - p.B[0], p.E[1] - p.B[1])).toBeCloseTo(95, 5);
  });
  it("la manche (couture d'épaule → bout du poignet) a la longueur saisie", () => {
    const p = hoo.points(mm, "le_long");
    const bout = [(p.C[0] + p.D[0]) / 2, (p.C[1] + p.D[1]) / 2];
    const proj = (bout[0] - p.SP[0]) * p.u[0] + (bout[1] - p.SP[1]) * p.u[1];
    expect(proj).toBeCloseTo(620, 5);
  });
});

describe("tous les gabarits disponibles", () => {
  for (const e of CATALOGUE.filter((c) => c.gabarit)) {
    const g = e.gabarit!;
    for (const t of TAILLES) for (const v of VUES) for (const pose of g.poses) {
      it(`${g.nom} ${t} ${v} ${pose} se dessine sans valeur invalide`, () => {
        const mm = enMm(mesuresCm(g.mesures, {}, t));
        const d = g.dessiner(mm, v, pose);
        expect(d.traces.length).toBeGreaterThan(3);
        d.traces.forEach((tr) => expect(tr.d).not.toMatch(/NaN|Infinity/));
        expect(g.controles?.(mm) ?? []).toEqual([]);
        const r = rendre(d, { couleurs: { principale: null, cotes: null, interieur: null, fil: null, accessoires: "#fff" }, zones: g.zones(mm, v), zonesActives: g.zones(mm, v).map((z) => z.id), retouches: [], marge: 40, fond: "#fff" });
        expect(r.calques.map((c) => c.nom)).toContain("REPÈRES — à masquer");
      });
    }
  }
});

describe("score de précision", () => {
  it("compte seulement les mesures saisies, pondérées par importance", () => {
    const r = scorePrecision(tshirt.mesures, new Set(["demi_poitrine", "longueur", "manche"]), []);
    expect(r.score).toBeGreaterThan(0);
    expect(r.score).toBeLessThan(100);
    expect(r.manquantes[0].niveau).toBe("recommande");
  });
  it("100 % quand tout est rempli", () => {
    expect(scorePrecision(tshirt.mesures, new Set(tshirt.mesures.map((d) => d.cle)), []).score).toBe(100);
  });
});
