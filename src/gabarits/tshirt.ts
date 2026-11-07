import type { Gabarit, Mesures, Pose, Pt, Trace, Vue, ZoneImpression, Alerte, Poignee, Finitions } from "../moteur/types";
import { FINITIONS_DEFAUT } from "../moteur/types";
import { add, mul, dir, perp, ligne, lisse, decaler, lerp, sub, norm, quad, miroir } from "../moteur/geom";
import { encolure, lire, dessin, plis } from "./commun";

/**
 * T-SHIRT — géométrie à plat.
 * Repère : x = 0 au milieu, y = 0 à la hauteur du point haut d'épaule (HPS), y vers le bas.
 * On construit le côté droit (vu de face) puis on le reflète.
 */
function points(m: Mesures, pose: Pose) {
  const demiPoitrine = lire(m, "demi_poitrine", 540) / 2;
  const L = lire(m, "longueur", 720);
  const demiEpaules = lire(m, "epaules", 460) / 2;
  const manche = lire(m, "manche", 210);
  const emmanchure = lire(m, "emmanchure", 230);
  const ouverture = lire(m, "ouverture_manche", 180);
  const demiBas = lire(m, "largeur_bas", 540) / 2;
  const demiEncolure = lire(m, "largeur_encolure", 180) / 2;

  // Pente d'épaule : proportionnelle à la longueur d'épaule (≈ 16°).
  const pente = Math.max(20, (demiEpaules - demiEncolure) * 0.28);
  const HPS: Pt = [demiEncolure, 0];
  const SP: Pt = [demiEpaules, pente];
  // L'emmanchure se mesure en droite du point d'épaule au dessous de bras.
  const dx = Math.max(10, demiPoitrine - demiEpaules);
  const dy = Math.sqrt(Math.max(emmanchure * emmanchure - dx * dx, (emmanchure * 0.6) ** 2));
  const UA: Pt = [demiPoitrine, pente + dy];
  const angle = pose === "ecartes" ? 30 : 58;
  const u = dir(angle);
  const n = perp(u); // vers le corps / le bas
  const SEo = add(SP, mul(u, manche));
  const SEi = add(SEo, mul(n, ouverture));
  const BAS: Pt = [demiBas, L];
  return { HPS, SP, UA, SEo, SEi, BAS, u, n, L, pente };
}

const sym = (pts: Pt[]) => pts.map(miroir);

function dessiner(m: Mesures, vue: Vue, pose: Pose, f: Finitions = FINITIONS_DEFAUT) {
  const p = points(m, pose);
  const hCol = lire(m, "hauteur_col", 20);
  const hOurlet = lire(m, "hauteur_ourlet", 20);
  const profEnc = vue === "face" ? lire(m, "prof_encolure_devant", 90) : lire(m, "prof_encolure_dos", 20);
  const demiEnc = p.HPS[0];

  // Bas légèrement arrondi.
  const basPts = quad(miroir(p.BAS), [0, p.L + (f.bas === "arrondi" ? 60 : 6)], p.BAS, 24);
  // Contour : droite (épaule → manche → dessous de bras → côté) puis bas puis gauche.
  const droite: Pt[] = [p.HPS, p.SP, p.SEo, p.SEi, p.UA, p.BAS];
  const gauche = sym(droite).reverse();
  const enc = encolure(demiEnc, profEnc); // de gauche à droite
  // Ordre du tour : droite → bas (de droite à gauche) → gauche → encolure.
  const tour: Pt[] = [...droite, ...[...basPts].reverse().slice(1, -1), ...gauche, ...enc.slice(1, -1)];

  const traces: Trace[] = [];
  // Intérieur visible par l'encolure (dos du col vu de face, ou devant vu de dos).
  const fondEnc = vue === "face"
    ? encolure(demiEnc, lire(m, "prof_encolure_dos", 20) + hCol * 0.6)
    : encolure(demiEnc, -hCol * 0.8);
  traces.push({ role: "interieur", d: ligne([...enc, ...[...fondEnc].reverse()], true), nom: "Intérieur encolure" });
  traces.push({ role: "piece", d: ligne(tour, true), nom: "Corps" });

  // Ombre sous la manche (aplat gris discret, comme sur un dessin technique).
  [1, -1].forEach((s) => {
    const f = (q: Pt): Pt => (s === 1 ? q : miroir(q));
    const a = p.UA, b = p.SEi;
    const c = add(lerp(a, b, 0.55), mul(norm(sub(p.SEo, p.SEi)), 14));
    traces.push({ role: "ombre", d: ligne([f(a), f(b), f(c)], true) });
  });

  // Bord-côte d'encolure.
  const coutureCol = encolure(demiEnc + hCol * 0.9, profEnc + hCol, hCol * 0.25);
  const bande = [...enc, ...[...coutureCol].reverse()];
  traces.push({ role: "cote", d: ligne(bande, true), nom: "Col" });
  // Rayures du col : relient les points correspondants des deux courbes.
  const ray: string[] = [];
  for (let i = 1; i < enc.length - 1; i += 1) ray.push(ligne([enc[i], coutureCol[i]]));
  traces.push({ role: "pli", d: ray.join(" "), nom: "Côtes du col" });
  traces.push({ role: "surpiqure", d: ligne(decaler(coutureCol, -3)), nom: "Surpiqûre col" });

  // Coutures d'emmanchure (montage de manche).
  [1, -1].forEach((s) => {
    const f = (q: Pt): Pt => (s === 1 ? q : miroir(q));
    const ctrl: Pt = [p.SP[0] + 4, (p.SP[1] + p.UA[1]) / 2];
    traces.push({ role: "couture", d: lisse(quad(f(p.SP), f(ctrl), f(p.UA), 10)), nom: "Emmanchure" });
    // Ourlet de manche.
    const a = add(p.SEo, mul(p.u, -hOurlet)), b = add(p.SEi, mul(p.u, -hOurlet));
    traces.push({ role: "surpiqure", d: ligne([f(a), f(b)]), nom: "Ourlet manche" });
    // Plis : aisselle et manche.
    plis(p.UA, lerp(p.UA, p.BAS, 0.35), 34, 2, -1).forEach((pl) =>
      traces.push({ role: "pli", d: lisse(pl.map((q) => f([q[0] - 10, q[1]]))) }),
    );
  });

  // Ourlet du bas (surpiqûre parallèle au bas).
  const ourlet = basPts.map(([x, y]) => [x * 0.985, y - hOurlet] as Pt);
  traces.push({ role: "surpiqure", d: lisse(ourlet), nom: "Ourlet bas" });
  // Plis verticaux doux sur le corps.
  traces.push({ role: "pli", d: lisse([[p.UA[0] * 0.55, p.L * 0.55], [p.UA[0] * 0.5, p.L * 0.75], [p.UA[0] * 0.58, p.L * 0.93]]) });
  traces.push({ role: "pli", d: lisse([[-p.UA[0] * 0.35, p.L * 0.62], [-p.UA[0] * 0.4, p.L * 0.8], [-p.UA[0] * 0.33, p.L * 0.95]]) });

  if (f.bas === "fentes") {
    // Fentes de côté : 4 cm ouverts au bas, avec point d'arrêt.
    [1, -1].forEach((s) => {
      const x = s * (p.BAS[0] - 1);
      traces.push({ role: "couture", d: ligne([[x, p.L - 40], [x, p.L]]), nom: "Fente de côté" });
      traces.push({ role: "couture", d: ligne([[x - s * 8, p.L - 40], [x, p.L - 40]]), nom: "Point d'arrêt" });
    });
  }
  if (vue === "dos" && f.bandeProprete) {
    // Bande de propreté col dos (visible à l'intérieur).
    traces.push({ role: "couture", d: ligne([[-demiEnc * 0.9, profEnc + hCol + 12], [demiEnc * 0.9, profEnc + hCol + 12]]), nom: "Bande de propreté" });
  }

  return dessin(traces, [...tour, ...coutureCol]);
}

function zones(m: Mesures, vue: Vue): ZoneImpression[] {
  const p = points(m, "ecartes");
  const pc = lire(m, "demi_poitrine", 540);
  const prof = vue === "face" ? lire(m, "prof_encolure_devant", 90) : lire(m, "prof_encolure_dos", 20);
  const hCol = lire(m, "hauteur_col", 20);
  const haut = prof + hCol;
  const utile = p.L - haut - 60;
  if (vue === "face") {
    return [
      { id: "coeur", nom: "Cœur", vue, cx: pc * 0.21, y: haut + 60, l: 100, h: 100 },
      { id: "centre", nom: "Centre devant", vue, cx: 0, y: haut + 50, l: Math.min(280, pc - 160), h: Math.min(300, utile * 0.55) },
      { id: "plein", nom: "Plein devant", vue, cx: 0, y: haut + 40, l: Math.min(350, pc - 110), h: Math.min(450, utile - 40) },
      { id: "bas", nom: "Bas de vêtement", vue, cx: -pc * 0.24, y: p.L - 150, l: 100, h: 90 },
    ];
  }
  return [
    { id: "nuque", nom: "Nuque", vue, cx: 0, y: haut + 25, l: 80, h: 50 },
    { id: "haut_dos", nom: "Haut du dos", vue, cx: 0, y: haut + 50, l: Math.min(300, pc - 160), h: 120 },
    { id: "dos", nom: "Dos complet", vue, cx: 0, y: haut + 50, l: Math.min(350, pc - 110), h: Math.min(450, utile - 30) },
  ];
}

function controles(m: Mesures): Alerte[] {
  const a: Alerte[] = [];
  if (m.manche > m.longueur * 0.5) a.push({ cle: "manche", message: "La manche dépasse la moitié de la longueur du corps : inhabituel pour un T-shirt manches courtes." });
  if (m.epaules > m.demi_poitrine * 1.08) a.push({ cle: "epaules", message: "Les épaules sont plus larges que la poitrine : vérifie ces deux mesures." });
  if (m.largeur_encolure > m.epaules * 0.6) a.push({ cle: "largeur_encolure", message: "Encolure très large par rapport aux épaules." });
  if (m.emmanchure > m.longueur * 0.45) a.push({ cle: "emmanchure", message: "Emmanchure très profonde par rapport à la longueur." });
  if (m.ouverture_manche > m.emmanchure) a.push({ cle: "ouverture_manche", message: "L'ouverture de manche est plus large que l'emmanchure." });
  return a;
}

function poignees(m: Mesures, _vue: Vue, pose: Pose): Poignee[] {
  const p = points(m, pose);
  return [
    { cle: "longueur", pos: [0, p.L], axe: [0, 1], facteur: 1 },
    { cle: "demi_poitrine", pos: p.UA, axe: [1, 0], facteur: 2 },
    { cle: "epaules", pos: p.SP, axe: [1, 0], facteur: 2 },
    { cle: "manche", pos: p.SEo, axe: p.u, facteur: 1 },
    { cle: "largeur_bas", pos: p.BAS, axe: [1, 0], facteur: 2 },
  ];
}

export const tshirt: Gabarit = {
  id: "tshirt",
  nom: "T-shirt",
  famille: "hauts",
  poseParDefaut: "ecartes",
  // Manches courtes : à plat, elles restent écartées.
  poses: ["ecartes"],
  finitions: ["piqure", "cotes", "bas", "bandeProprete"],
  mesures: [
    { cle: "demi_poitrine", libelle: "Demi-tour de poitrine", aide: "À plat, d'un côté à l'autre, 2,5 cm sous l'emmanchure.", niveau: "obligatoire", defautM: 54, gradation: 2.5, min: 35, max: 90,
      cote: (m) => { const p = points(m, "ecartes"); return { a: [-p.UA[0], p.UA[1] + 25], b: [p.UA[0], p.UA[1] + 25] }; } },
    { cle: "longueur", libelle: "Longueur totale", aide: "Du point haut de l'épaule (contre le col) jusqu'au bas.", niveau: "obligatoire", defautM: 72, gradation: 2, min: 40, max: 110,
      cote: (m) => { const p = points(m, "ecartes"); return { a: [p.HPS[0], 0], b: [p.HPS[0], p.L], decalage: 0 }; } },
    { cle: "manche", libelle: "Longueur de manche", aide: "De la couture d'épaule au bout de la manche, le long du dessus.", niveau: "obligatoire", defautM: 21, gradation: 1, min: 8, max: 40,
      cote: (m) => { const p = points(m, "ecartes"); return { a: p.SP, b: p.SEo, decalage: -18 }; } },
    { cle: "epaules", libelle: "Largeur d'épaules", aide: "D'une couture d'épaule à l'autre, en ligne droite.", niveau: "recommande", defautM: 46, gradation: 1.5, min: 30, max: 75,
      cote: (m) => { const p = points(m, "ecartes"); return { a: miroir(p.SP), b: p.SP, decalage: -40 }; } },
    { cle: "emmanchure", libelle: "Hauteur d'emmanchure", aide: "En droite, du point d'épaule jusqu'au dessous de bras.", niveau: "recommande", defautM: 23, gradation: 1, min: 14, max: 40,
      cote: (m) => { const p = points(m, "ecartes"); return { a: p.SP, b: p.UA, decalage: 0 }; } },
    { cle: "ouverture_manche", libelle: "Ouverture de manche", aide: "Largeur à plat du bas de la manche.", niveau: "recommande", defautM: 18, gradation: 0.75, min: 8, max: 35,
      cote: (m) => { const p = points(m, "ecartes"); return { a: p.SEo, b: p.SEi, decalage: 16 }; } },
    { cle: "largeur_bas", libelle: "Largeur du bas", aide: "À plat, d'un côté à l'autre, tout en bas.", niveau: "recommande", defautM: 54, gradation: 2.5, min: 35, max: 90,
      cote: (m) => { const p = points(m, "ecartes"); return { a: miroir(p.BAS), b: p.BAS, decalage: 30 }; } },
    { cle: "largeur_encolure", libelle: "Largeur d'encolure", aide: "D'une couture de col à l'autre, au niveau des épaules.", niveau: "recommande", defautM: 18, gradation: 0.5, min: 12, max: 32,
      cote: (m) => { const p = points(m, "ecartes"); return { a: miroir(p.HPS), b: p.HPS, decalage: -20 }; } },
    { cle: "prof_encolure_devant", libelle: "Profondeur d'encolure devant", aide: "Du haut de l'épaule (ligne droite entre les deux) au creux du col devant.", niveau: "optionnel", defautM: 9, gradation: 0.3, min: 3, max: 25,
      cote: (m, v) => (v === "face" ? { a: [0, 0], b: [0, lire(m, "prof_encolure_devant", 90)], decalage: 0 } : null) },
    { cle: "prof_encolure_dos", libelle: "Profondeur d'encolure dos", aide: "Même mesure côté dos.", niveau: "optionnel", defautM: 2, gradation: 0, min: 0.5, max: 10,
      cote: (m, v) => (v === "dos" ? { a: [0, 0], b: [0, lire(m, "prof_encolure_dos", 20)], decalage: 0 } : null) },
    { cle: "hauteur_col", libelle: "Hauteur du bord-côte de col", aide: "Largeur de la bande de col.", niveau: "optionnel", defautM: 2, gradation: 0, min: 0.5, max: 5 },
    { cle: "hauteur_ourlet", libelle: "Hauteur des ourlets", aide: "Distance entre le bord et la surpiqûre (bas et manches).", niveau: "optionnel", defautM: 2, gradation: 0, min: 0.5, max: 5 },
  ],
  dessiner,
  zones,
  controles,
  poignees,
};

export const _interne = { points };
