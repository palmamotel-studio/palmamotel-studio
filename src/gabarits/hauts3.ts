import type { Gabarit, Mesures, Pose, Pt, Trace, Vue, Finitions, ZoneImpression } from "../moteur/types";
import { FINITIONS_DEFAUT } from "../moteur/types";
import { add, mul, ligne, lisse, decaler, quad, miroir, rayures } from "../moteur/geom";
import { encolure, lire, dessin, cubique } from "./commun";
import { tshirt, _interne as ts } from "./tshirt";

const rond = (c: Pt, r: number) => `M ${c[0] - r} ${c[1]} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0`;

/* ======================= POLO ======================= */
/** Polo : corps de T-shirt, col polo en maille, patte de boutonnage, bords-côtes de manche. */
function dessinerPolo(m: Mesures, vue: Vue, pose: Pose, f: Finitions = FINITIONS_DEFAUT) {
  const base = tshirt.dessiner(m, vue, pose, f);
  const p = ts.points(m, pose);
  const dE = p.HPS[0];
  const traces: Trace[] = base.traces.filter((t) => !/^(Col|Côtes du col|Surpiqûre col|Intérieur encolure|Ourlet manche)/.test(t.nom || ""));
  const temoins: Pt[] = [];
  const hP = lire(m, "patte", 140), lP = 30;
  // Poignets en côte.
  [1, -1].forEach((s) => {
    const fx = (q: number[]): Pt => (s === 1 ? [q[0], q[1]] : [-q[0], q[1]]);
    const a = p.SEo, b = p.SEi, c = add(p.SEi, mul(p.u, -25)), d = add(p.SEo, mul(p.u, -25));
    traces.push({ role: "cote", d: ligne([a, b, c, d].map(fx), true), nom: "Bord-côte de manche" });
    traces.push({ role: "pli", d: rayures(fx(d), fx(c), fx(a), fx(b), 3.5), nom: "Côtes de manche" });
  });
  if (vue === "face") {
    // Encolure intérieure visible et patte de boutonnage.
    traces.push({ role: "interieur", d: ligne([...encolure(dE, 60), ...encolure(dE, 18).reverse()], true), nom: "Intérieur encolure" });
    traces.push({ role: "piece", d: ligne([[-lP / 2, 50], [lP / 2, 50], [lP / 2, 50 + hP], [-lP / 2, 50 + hP]], true), nom: "Patte de boutonnage" });
    traces.push({ role: "surpiqure", d: ligne([[-lP / 2 + 3, 50 + hP - 3], [lP / 2 - 3, 50 + hP - 3]]) + " " + ligne([[lP / 2 - 3, 55], [lP / 2 - 3, 50 + hP - 3]]) + " " + ligne([[-lP / 2 + 3, 55], [-lP / 2 + 3, 50 + hP - 3]]), nom: "Surpiqûre patte" });
    for (let i = 0; i < 3; i++) traces.push({ role: "accessoire", d: rond([0, 75 + i * (hP - 45) / 2], 5), nom: "Bouton" });
    // Col polo : deux pointes rabattues.
    [-1, 1].forEach((s) => {
      const col: Pt[] = [[s * (dE + 14), 2], [s * (dE + 6), 40], [s * 72, 92], [s * 6, 58], [s * (dE - 26), -16]];
      traces.push({ role: "cote", d: lisse(col, true, 0.75), nom: "Col polo" });
      traces.push({ role: "surpiqure", d: ligne([[s * (dE + 4), 42], [s * 66, 84]]), nom: "Côte du col" });
    });
    temoins.push([0, -20]);
  } else {
    const col: Pt[] = [[-(dE + 14), 2], [-(dE + 22), 56], [dE + 22, 56], [dE + 14, 2], [0, -22]];
    traces.push({ role: "cote", d: lisse(col, true, 0.8), nom: "Col polo" });
    traces.push({ role: "surpiqure", d: ligne([[-(dE + 16), 48], [dE + 16, 48]]), nom: "Côte du col" });
    temoins.push([0, -24]);
  }
  return dessin(traces, [...temoins, [base.boite.x, base.boite.y], [base.boite.x + base.boite.l, base.boite.y + base.boite.h]]);
}

export const polo: Gabarit = {
  ...tshirt,
  id: "polo",
  nom: "Polo",
  finitions: ["piqure", "bas"],
  mesures: [
    ...tshirt.mesures.filter((d) => !["hauteur_col", "prof_encolure_devant", "prof_encolure_dos"].includes(d.cle)).map((d) =>
      d.cle === "manche" ? { ...d, defautM: 22 } : d.cle === "longueur" ? { ...d, defautM: 73 } : d),
    { cle: "patte", libelle: "Longueur de la patte de boutonnage", aide: "Du col au bas de la patte.", niveau: "optionnel", defautM: 14, gradation: 0, min: 8, max: 25 },
  ],
  dessiner: dessinerPolo,
  zones: (m, v) => tshirt.zones(m, v).map((z) => (z.id === "centre" || z.id === "plein" ? { ...z, y: z.y + 120, h: Math.max(80, z.h - 120) } : z)),
};

/* ======================= DÉBARDEUR ======================= */
function pointsDeb(m: Mesures) {
  const demiP = lire(m, "demi_poitrine", 520) / 2;
  const L = lire(m, "longueur", 720);
  const dE = lire(m, "largeur_encolure", 200) / 2;
  const bretelle = lire(m, "largeur_bretelle", 45);
  const emm = lire(m, "prof_emmanchure", 250);
  const demiBas = lire(m, "largeur_bas", 520) / 2;
  const HPS: Pt = [dE, 0];
  const SP: Pt = [dE + bretelle, 8];
  const UA: Pt = [demiP, emm];
  const BAS: Pt = [demiBas, L];
  return { dE, HPS, SP, UA, BAS, L, demiP };
}

function dessinerDeb(m: Mesures, vue: Vue, _pose: Pose, f: Finitions = FINITIONS_DEFAUT) {
  const p = pointsDeb(m);
  const prof = vue === "face" ? lire(m, "prof_encolure_devant", 140) : lire(m, "prof_encolure_dos", 60);
  const enc = encolure(p.dE, prof);
  const emm = cubique(p.SP, [p.SP[0] + 6, p.UA[1] * 0.55], [p.UA[0] - 40, p.UA[1] - 6], p.UA, 14);
  const basPts = quad(miroir(p.BAS), [0, p.L + (f.bas === "arrondi" ? 60 : 6)], p.BAS, 20);
  const droite: Pt[] = [p.HPS, ...emm, p.BAS];
  const tour: Pt[] = [...droite, ...[...basPts].reverse().slice(1, -1), ...droite.map(miroir).reverse(), ...enc.slice(1, -1)];
  const traces: Trace[] = [];
  traces.push({ role: "interieur", d: ligne([...enc, ...encolure(p.dE, vue === "face" ? 40 : -10).reverse()], true), nom: "Intérieur encolure" });
  traces.push({ role: "piece", d: ligne(tour, true), nom: "Corps" });
  // Bandes d'encolure et d'emmanchure en côte (ou bord replié).
  const bande = (pts: Pt[], larg: number) => decaler(pts, larg);
  const encB = bande(enc, -12);
  traces.push({ role: "cote", d: ligne([...enc, ...encB.reverse()], true), nom: "Bande d'encolure" });
  [1, -1].forEach((s) => {
    const fx = (q: number[]): Pt => (s === 1 ? [q[0], q[1]] : [-q[0], q[1]]);
    const b = bande(emm, s === 1 ? 12 : 12);
    traces.push({ role: "cote", d: ligne([...emm, ...b.reverse()].map(fx), true), nom: "Bande d'emmanchure" });
    traces.push({ role: "surpiqure", d: lisse(bande(emm, 15).map(fx)), nom: "Surpiqûre emmanchure" });
  });
  traces.push({ role: "surpiqure", d: lisse(decaler(enc, -15)), nom: "Surpiqûre encolure" });
  traces.push({ role: "surpiqure", d: lisse(basPts.map(([x, y]) => [x * 0.985, y - 20] as Pt)), nom: "Ourlet bas" });
  traces.push({ role: "pli", d: lisse([[p.demiP * 0.5, p.L * 0.5], [p.demiP * 0.45, p.L * 0.75], [p.demiP * 0.52, p.L * 0.95]]) });
  traces.push({ role: "pli", d: lisse([[-p.demiP * 0.4, p.L * 0.55], [-p.demiP * 0.45, p.L * 0.8], [-p.demiP * 0.38, p.L * 0.95]]) });
  return dessin(traces, tour);
}

export const debardeur: Gabarit = {
  id: "debardeur",
  nom: "Débardeur",
  famille: "hauts",
  poseParDefaut: "ecartes",
  poses: ["ecartes"],
  finitions: ["piqure", "cotes", "bas"],
  mesures: [
    { cle: "demi_poitrine", libelle: "Demi-tour de poitrine", aide: "À plat, sous les emmanchures.", niveau: "obligatoire", defautM: 52, gradation: 2.5, min: 35, max: 80,
      cote: (m) => { const p = pointsDeb(m); return { a: [-p.UA[0], p.UA[1] + 25], b: [p.UA[0], p.UA[1] + 25] }; } },
    { cle: "longueur", libelle: "Longueur totale", aide: "Du haut de la bretelle (contre le col) au bas.", niveau: "obligatoire", defautM: 72, gradation: 2, min: 40, max: 100,
      cote: (m) => { const p = pointsDeb(m); return { a: [p.dE + 20, 0], b: [p.dE + 20, p.L] }; } },
    { cle: "prof_emmanchure", libelle: "Profondeur d'emmanchure", aide: "Du haut de la bretelle au dessous de bras, à la verticale.", niveau: "recommande", defautM: 25, gradation: 1, min: 15, max: 40,
      cote: (m) => { const p = pointsDeb(m); return { a: [p.UA[0] + 20, 0], b: [p.UA[0] + 20, p.UA[1]] }; } },
    { cle: "largeur_bretelle", libelle: "Largeur de bretelle", aide: "À plat, sur l'épaule.", niveau: "recommande", defautM: 4.5, gradation: 0.25, min: 1, max: 12 },
    { cle: "largeur_encolure", libelle: "Largeur d'encolure", aide: "D'une bretelle à l'autre, côté col.", niveau: "recommande", defautM: 20, gradation: 0.5, min: 12, max: 35 },
    { cle: "prof_encolure_devant", libelle: "Profondeur d'encolure devant", aide: "Du haut des bretelles au creux du col.", niveau: "optionnel", defautM: 14, gradation: 0.5, min: 4, max: 30 },
    { cle: "prof_encolure_dos", libelle: "Profondeur d'encolure dos", aide: "Même mesure côté dos.", niveau: "optionnel", defautM: 6, gradation: 0.3, min: 1, max: 30 },
    { cle: "largeur_bas", libelle: "Largeur du bas", aide: "À plat, tout en bas.", niveau: "recommande", defautM: 52, gradation: 2.5, min: 35, max: 85,
      cote: (m) => { const p = pointsDeb(m); return { a: miroir(p.BAS), b: p.BAS, decalage: 30 }; } },
  ],
  dessiner: dessinerDeb,
  zones: (m, vue): ZoneImpression[] => {
    const p = pointsDeb(m);
    return vue === "face"
      ? [{ id: "coeur", nom: "Cœur", vue, cx: p.demiP * 0.4, y: p.UA[1] - 40, l: 90, h: 90 }, { id: "centre", nom: "Centre devant", vue, cx: 0, y: lire(m, "prof_encolure_devant", 140) + 40, l: Math.min(260, p.demiP * 2 - 160), h: 280 }]
      : [{ id: "dos", nom: "Dos complet", vue, cx: 0, y: lire(m, "prof_encolure_dos", 60) + 40, l: Math.min(320, p.demiP * 2 - 120), h: Math.min(420, p.L - 200) }];
  },
  controles: (m) => (m.prof_emmanchure > m.longueur * 0.6 ? [{ cle: "prof_emmanchure", message: "Emmanchure très profonde par rapport à la longueur." }] : []),
  poignees: (m) => { const p = pointsDeb(m); return [{ cle: "longueur", pos: [0, p.L], axe: [0, 1], facteur: 1 }, { cle: "demi_poitrine", pos: p.UA, axe: [1, 0], facteur: 2 }]; },
};
