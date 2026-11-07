import type { Gabarit, Mesures, Pose, Pt, Trace, Vue, ZoneImpression, Alerte, Poignee } from "../moteur/types";
import { add, mul, dir, perp, ligne, lisse, decaler, rayures, lerp, sub, norm, quad, miroir } from "../moteur/geom";
import { lire, dessin, cubique } from "./commun";

/**
 * HOODIE (sweat à capuche, poche kangourou, poignets et bas en bord-côte).
 * Repère identique au T-shirt : x = 0 au milieu, y = 0 au point haut d'épaule.
 */
function points(m: Mesures, pose: Pose) {
  const demiPoitrine = lire(m, "demi_poitrine", 580) / 2;
  const L = lire(m, "longueur", 700);
  const demiEpaules = lire(m, "epaules", 540) / 2;
  const manche = lire(m, "manche", 620);
  const emmanchure = lire(m, "emmanchure", 270);
  const biceps = lire(m, "largeur_manche", 230);
  const poignet = lire(m, "poignet", 95);
  const hPoignet = lire(m, "hauteur_poignet", 70);
  const hBas = lire(m, "hauteur_bas", 70);
  const demiCote = lire(m, "largeur_bas", 480) / 2;
  const demiEncolure = lire(m, "largeur_encolure", 200) / 2;

  const pente = Math.max(22, (demiEpaules - demiEncolure) * 0.26);
  const HPS: Pt = [demiEncolure, 0];
  const SP: Pt = [demiEpaules, pente];
  const dx = Math.max(10, demiPoitrine - demiEpaules);
  const dy = Math.sqrt(Math.max(emmanchure * emmanchure - dx * dx, (emmanchure * 0.6) ** 2));
  const UA: Pt = [demiPoitrine, pente + dy];

  const angle = pose === "ecartes" ? 36 : 77;
  const u = dir(angle);
  const n = perp(u);
  // Point de dessous de bras côté manche.
  let I0: Pt;
  if (pose === "ecartes") {
    // La manche se raccorde au corps sur le côté, à la largeur de biceps voulue.
    const t = Math.max(0, (UA[0] - SP[0] - n[0] * biceps) / Math.max(0.2, u[0]));
    I0 = add(add(SP, mul(n, biceps)), mul(u, Math.min(t, manche * 0.4)));
    I0 = [Math.max(I0[0], UA[0] - 4), Math.max(I0[1], UA[1])];
  } else {
    // Bras le long du corps : la manche recouvre le côté du corps.
    I0 = [UA[0] - biceps * 0.28, UA[1] + 10];
  }
  // Bout de manche (couture du poignet), légèrement froncé : plus large que le poignet.
  const lgMancheSansPoignet = manche - hPoignet;
  const A = add(SP, mul(u, lgMancheSansPoignet));
  const largeurFronce = Math.min(biceps * 0.85, poignet * 1.4);
  const F = add(A, mul(n, largeurFronce));
  const mil = lerp(A, F, 0.5);
  const tAF = norm(sub(F, A));
  const B = add(mil, mul(tAF, -poignet / 2));
  const E = add(mil, mul(tAF, poignet / 2));
  const C = add(B, mul(u, hPoignet));
  const D = add(E, mul(u, hPoignet));

  const yCote = L - hBas;
  const demiCorps = Math.max(demiCote + 25, demiPoitrine - 8);
  return { HPS, SP, UA, I0, A, F, B, C, D, E, u, n, L, yCote, demiCorps, demiCote, pente, angle };
}

const f2 = (s: number) => (q: Pt): Pt => (s === 1 ? q : miroir(q));

function capuche(m: Mesures, demiEnc: number) {
  const H = lire(m, "hauteur_capuche", 360);
  const W = lire(m, "largeur_capuche", 260) * 1.1;
  const base: Pt = [demiEnc + 22, 18];
  const droite: Pt[] = [base, [W / 2, -H * 0.3], [W * 0.4, -H * 0.78], [W * 0.12, -H * 0.99]];
  const gauche = droite.map(miroir).reverse();
  const tour: Pt[] = [...droite, [0, -H], ...gauche];
  return { H, W, contour: lisse(tour, true), tour };
}

function dessiner(m: Mesures, vue: Vue, pose: Pose) {
  const p = points(m, pose);
  const demiEnc = p.HPS[0];
  const traces: Trace[] = [];
  const temoins: Pt[] = [];

  // ---- Corps ----
  const droite: Pt[] = [p.HPS, p.SP, p.UA, [p.demiCorps, p.yCote - 30]];
  const basCorps: Pt[] = quad([p.demiCorps, p.yCote - 30], [p.demiCorps * 0.98, p.yCote], [p.demiCote, p.yCote], 8);
  const cDroit: Pt[] = [...droite, ...basCorps.slice(1)];
  const cGauche = cDroit.map(miroir).reverse();
  const encolureCorps: Pt[] = cubique([-demiEnc, 0], [-demiEnc * 0.6, 40], [demiEnc * 0.6, 40], [demiEnc, 0], 12);
  const corps: Pt[] = [...cDroit, ...cGauche, ...encolureCorps.slice(1, -1)];
  traces.push({ role: "piece", d: ligne(corps, true), nom: "Corps" });
  temoins.push(...corps);

  // ---- Bord-côte du bas ----
  const cote: Pt[] = [[-p.demiCote, p.yCote], [p.demiCote, p.yCote], [p.demiCote - 3, p.L], [-p.demiCote + 3, p.L]];
  traces.push({ role: "cote", d: ligne(cote, true), nom: "Bord-côte bas" });
  traces.push({ role: "pli", d: rayures(cote[0], cote[1], cote[3], cote[2], 4), nom: "Côtes bas" });
  traces.push({ role: "surpiqure", d: ligne([[-p.demiCote + 2, p.yCote - 5], [p.demiCote - 2, p.yCote - 5]]), nom: "Surpiqûre bas" });
  temoins.push(...cote);

  // ---- Poche kangourou (face) ----
  if (vue === "face") {
    const lb = lire(m, "poche_largeur", 360) / 2;
    const lh = lire(m, "poche_haut", 260) / 2;
    const ph = lire(m, "poche_hauteur", 200);
    const yb = p.yCote, yt = p.yCote - ph;
    const gaucheOuv = quad([-lh, yt], [-lb + 4, yt + ph * 0.25], [-lb, yb - 4], 10);
    const poche: Pt[] = [[-lh, yt], [lh, yt], ...gaucheOuv.map(miroir).slice(1), [lb, yb], [-lb, yb], ...gaucheOuv.slice(0, -1).reverse()];
    traces.push({ role: "piece", d: ligne(poche, true), nom: "Poche kangourou" });
    traces.push({ role: "surpiqure", d: ligne(decaler(gaucheOuv, -6)), nom: "Surpiqûre poche" });
    traces.push({ role: "surpiqure", d: ligne(decaler(gaucheOuv.map(miroir), 6)), nom: "Surpiqûre poche" });
    traces.push({ role: "surpiqure", d: ligne([[-lh + 6, yt + 6], [lh - 6, yt + 6]]), nom: "Surpiqûre poche" });
  }

  // Plis du corps.
  traces.push({ role: "pli", d: lisse([[p.demiCorps * 0.5, p.UA[1] + 60], [p.demiCorps * 0.42, p.yCote * 0.7], [p.demiCorps * 0.5, p.yCote - 50]]) });
  traces.push({ role: "pli", d: lisse([[-p.demiCorps * 0.45, p.UA[1] + 90], [-p.demiCorps * 0.5, p.yCote * 0.72], [-p.demiCorps * 0.42, p.yCote - 60]]) });

  // ---- Manches (dessinées par-dessus le corps) ----
  [1, -1].forEach((s) => {
    const f = f2(s);
    const fronceA = quad(p.A, lerp(lerp(p.A, p.F, 0.5), add(lerp(p.A, p.F, 0.5), p.u), 1), p.F, 2);
    const manche: Pt[] = [p.SP, p.A, ...fronceA.slice(1, -1), p.F, p.I0];
    // Contour de manche : épaule → bout → dessous → aisselle, puis emmanchure jusqu'à l'épaule.
    const emm = quad(p.I0, [p.SP[0] + 6, (p.SP[1] + p.I0[1]) / 2], p.SP, 10);
    const tour = [...manche, ...emm.slice(1, -1)].map(f);
    traces.push({ role: "piece", d: lisse(tour, true, 0.85), nom: s === 1 ? "Manche gauche" : "Manche droite" });
    temoins.push(...tour);
    // Ombre sous la manche.
    const o1 = lerp(p.I0, p.F, 0.15), o2 = lerp(p.I0, p.F, 0.92);
    const o3 = add(lerp(p.I0, p.F, 0.6), mul(p.n, -16));
    traces.push({ role: "ombre", d: lisse([o1, o3, o2].map(f), true, 0.5) });
    // Couture d'emmanchure.
    traces.push({ role: "couture", d: lisse(emm.map(f)), nom: "Emmanchure" });
    traces.push({ role: "surpiqure", d: lisse(decaler(emm, -5).map(f)), nom: "Surpiqûre emmanchure" });
    // Fronces au-dessus du poignet.
    for (let i = 1; i <= 3; i++) {
      const b = lerp(p.A, p.F, i / 4);
      traces.push({ role: "pli", d: lisse([b, add(b, mul(p.u, -28)), add(add(b, mul(p.u, -50)), mul(p.n, 4))].map(f)) });
    }
    // Plis de coude.
    const coude = lerp(p.SP, p.A, 0.55);
    traces.push({ role: "pli", d: lisse([add(coude, mul(p.n, 25)), add(add(coude, mul(p.n, 60)), mul(p.u, 25)), add(add(coude, mul(p.n, 90)), mul(p.u, 20))].map(f)) });
    // Poignet en bord-côte.
    const poignet = [p.B, p.E, p.D, p.C].map(f);
    traces.push({ role: "cote", d: ligne(poignet, true), nom: s === 1 ? "Poignet gauche" : "Poignet droit" });
    traces.push({ role: "pli", d: rayures(f(p.B), f(p.E), f(p.C), f(p.D), 3.5).toString(), nom: "Côtes poignet" });
    temoins.push(...poignet);
  });

  // ---- Capuche ----
  const cap = capuche(m, demiEnc);
  temoins.push(...cap.tour);
  if (vue === "face") {
    traces.push({ role: "piece", d: cap.contour, nom: "Capuche" });
    // Ouverture visage : intérieur de capuche visible.
    const H = cap.H, W = cap.W;
    const ouverture: Pt[] = [[0, 70], [-demiEnc * 0.55, 20], [-W * 0.33, -H * 0.35], [-W * 0.22, -H * 0.8], [0, -H * 0.9], [W * 0.22, -H * 0.8], [W * 0.33, -H * 0.35], [demiEnc * 0.55, 20]];
    traces.push({ role: "interieur", d: lisse(ouverture, true, 0.2), nom: "Intérieur capuche" });
    traces.push({ role: "surpiqure", d: lisse(ouverture.map(([x, y]) => [x * 1.09, y * 1.04 + (y > 0 ? 6 : 0)] as Pt), true, 0.2), nom: "Surpiqûre capuche" });
    // Croisement des bords de capuche au milieu devant.
    traces.push({ role: "couture", d: ligne([[-demiEnc * 0.55, 20], [12, 74]]), nom: "Croisement capuche" });
    // Œillets et cordons.
    const oeil: Pt[] = [[-48, 32], [48, 32]];
    const lgCordon = lire(m, "cordon", 320);
    oeil.forEach(([x, y], i) => {
      const bout: Pt = [x + (i ? 8 : -8), y + lgCordon * 0.75];
      traces.push({ role: "accessoire", d: `M ${x} ${y} Q ${x + (i ? 4 : -4)} ${y + lgCordon * 0.4} ${bout[0]} ${bout[1]}`, nom: "Cordon" });
      traces.push({ role: "accessoire", d: `M ${bout[0] - 3.5} ${bout[1]} h 7 v 26 h -7 Z`, nom: "Embout" });
      traces.push({ role: "accessoire", d: `M ${x - 5} ${y} a 5 5 0 1 0 10 0 a 5 5 0 1 0 -10 0`, nom: "Œillet" });
      temoins.push(bout);
    });
  } else {
    traces.push({ role: "piece", d: cap.contour, nom: "Capuche" });
    // Panneau central de capuche + surpiqûres.
    const H = cap.H;
    traces.push({ role: "couture", d: ligne([[-28, -H * 0.995], [-28, 14]]), nom: "Panneau capuche" });
    traces.push({ role: "couture", d: ligne([[28, -H * 0.995], [28, 14]]), nom: "Panneau capuche" });
    traces.push({ role: "surpiqure", d: ligne([[-22, -H * 0.98], [-22, 12]]) + " " + ligne([[22, -H * 0.98], [22, 12]]), nom: "Surpiqûre panneau" });
    traces.push({ role: "surpiqure", d: lisse(cubique([-demiEnc - 18, 22], [-demiEnc * 0.6, 34], [demiEnc * 0.6, 34], [demiEnc + 18, 22], 10)), nom: "Surpiqûre col" });
  }
  return dessin(traces, temoins);
}

function zones(m: Mesures, vue: Vue): ZoneImpression[] {
  const p = points(m, "ecartes");
  const pc = lire(m, "demi_poitrine", 580);
  const ph = lire(m, "poche_hauteur", 200);
  const lh = lire(m, "poche_haut", 260);
  if (vue === "face") {
    const yPoche = p.yCote - ph;
    return [
      { id: "coeur", nom: "Cœur", vue, cx: pc * 0.2, y: 120, l: 100, h: 100 },
      { id: "centre", nom: "Centre devant", vue, cx: 0, y: 110, l: Math.min(280, pc - 170), h: Math.max(80, Math.min(260, yPoche - 140)) },
      { id: "poche", nom: "Poche", vue, cx: 0, y: yPoche + 30, l: Math.max(60, lh - 70), h: Math.max(50, ph - 70) },
    ];
  }
  return [
    { id: "nuque", nom: "Nuque", vue, cx: 0, y: 60, l: 80, h: 50 },
    { id: "haut_dos", nom: "Haut du dos", vue, cx: 0, y: 80, l: Math.min(300, pc - 170), h: 120 },
    { id: "dos", nom: "Dos complet", vue, cx: 0, y: 80, l: Math.min(380, pc - 130), h: Math.min(450, p.yCote - 140) },
    { id: "capuche", nom: "Capuche", vue, cx: 0, y: -lire(m, "hauteur_capuche", 360) * 0.75, l: 140, h: 140 },
  ];
}

function controles(m: Mesures): Alerte[] {
  const a: Alerte[] = [];
  if (m.manche < m.longueur * 0.6) a.push({ cle: "manche", message: "Manche courte pour un hoodie : vérifie qu'elle est bien mesurée depuis la couture d'épaule." });
  if (m.poignet > m.largeur_manche) a.push({ cle: "poignet", message: "Le poignet est plus large que la manche." });
  if (m.largeur_bas > m.demi_poitrine) a.push({ cle: "largeur_bas", message: "Le bord-côte du bas est plus large que la poitrine." });
  if (m.poche_largeur > m.demi_poitrine * 0.8) a.push({ cle: "poche_largeur", message: "Poche très large par rapport au corps." });
  if (m.poche_hauteur > m.longueur * 0.45) a.push({ cle: "poche_hauteur", message: "Poche très haute par rapport à la longueur." });
  if (m.epaules > m.demi_poitrine * 1.1) a.push({ cle: "epaules", message: "Les épaules sont plus larges que la poitrine." });
  return a;
}

function poignees(m: Mesures, _vue: Vue, pose: Pose): Poignee[] {
  const p = points(m, pose);
  return [
    { cle: "longueur", pos: [0, p.L], axe: [0, 1], facteur: 1 },
    { cle: "demi_poitrine", pos: [p.demiCorps, p.UA[1] + 40], axe: [1, 0], facteur: 2 },
    { cle: "epaules", pos: p.SP, axe: [1, 0], facteur: 2 },
    { cle: "manche", pos: lerp(p.C, p.D, 0.5), axe: p.u, facteur: 1 },
  ];
}

export const hoodie: Gabarit = {
  id: "hoodie",
  nom: "Hoodie",
  famille: "hauts",
  poseParDefaut: "ecartes",
  poses: ["ecartes", "le_long"],
  mesures: [
    { cle: "demi_poitrine", libelle: "Demi-tour de poitrine", aide: "À plat, d'un côté à l'autre, 2,5 cm sous l'emmanchure.", niveau: "obligatoire", defautM: 58, gradation: 2.5, min: 40, max: 95,
      cote: (m) => { const p = points(m, "ecartes"); return { a: [-p.demiCorps, p.UA[1] + 25], b: [p.demiCorps, p.UA[1] + 25] }; } },
    { cle: "longueur", libelle: "Longueur totale", aide: "Du point haut de l'épaule jusqu'au bas du bord-côte (sans la capuche).", niveau: "obligatoire", defautM: 70, gradation: 2, min: 45, max: 110,
      cote: (m) => { const p = points(m, "ecartes"); return { a: [p.HPS[0] + 30, 0], b: [p.HPS[0] + 30, p.L] }; } },
    { cle: "manche", libelle: "Longueur de manche", aide: "De la couture d'épaule au bout du poignet.", niveau: "obligatoire", defautM: 62, gradation: 1, min: 35, max: 90,
      cote: (m) => { const p = points(m, "ecartes"); return { a: p.SP, b: add(p.SP, mul(p.u, lire(m, "manche", 620))), decalage: -22 }; } },
    { cle: "epaules", libelle: "Largeur d'épaules", aide: "D'une couture d'épaule à l'autre (épaule tombante : couture basse).", niveau: "recommande", defautM: 54, gradation: 2, min: 35, max: 80,
      cote: (m) => { const p = points(m, "ecartes"); return { a: miroir(p.SP), b: p.SP, decalage: -50 }; } },
    { cle: "emmanchure", libelle: "Hauteur d'emmanchure", aide: "En droite, du point d'épaule au dessous de bras.", niveau: "recommande", defautM: 27, gradation: 1, min: 16, max: 42,
      cote: (m) => { const p = points(m, "ecartes"); return { a: p.SP, b: p.UA }; } },
    { cle: "largeur_manche", libelle: "Largeur de manche (biceps)", aide: "À plat, en haut de la manche, perpendiculaire à la manche.", niveau: "recommande", defautM: 23, gradation: 0.75, min: 12, max: 40 },
    { cle: "poignet", libelle: "Largeur du poignet", aide: "À plat, largeur du bord-côte de poignet.", niveau: "recommande", defautM: 9.5, gradation: 0.5, min: 5, max: 20,
      cote: (m) => { const p = points(m, "ecartes"); return { a: p.C, b: p.D, decalage: 14 }; } },
    { cle: "largeur_bas", libelle: "Largeur du bord-côte du bas", aide: "À plat, au repos, sans étirer.", niveau: "recommande", defautM: 48, gradation: 2.5, min: 30, max: 90,
      cote: (m) => { const p = points(m, "ecartes"); return { a: [-p.demiCote, p.L], b: [p.demiCote, p.L], decalage: 28 }; } },
    { cle: "hauteur_bas", libelle: "Hauteur du bord-côte du bas", aide: "Hauteur de la bande en bas.", niveau: "optionnel", defautM: 7, gradation: 0, min: 2, max: 15 },
    { cle: "hauteur_poignet", libelle: "Hauteur des poignets", aide: "Hauteur de la bande de poignet.", niveau: "optionnel", defautM: 7, gradation: 0, min: 2, max: 15 },
    { cle: "largeur_encolure", libelle: "Largeur d'encolure", aide: "D'une couture de capuche à l'autre, au niveau des épaules.", niveau: "optionnel", defautM: 20, gradation: 0.5, min: 14, max: 32 },
    { cle: "hauteur_capuche", libelle: "Hauteur de capuche", aide: "Capuche à plat : de la couture du col jusqu'au sommet.", niveau: "recommande", defautM: 36, gradation: 0.5, min: 25, max: 50,
      cote: (m, v) => ({ a: [0, 0], b: [0, -lire(m, "hauteur_capuche", 360)], decalage: v === "face" ? -120 : -90 }) },
    { cle: "largeur_capuche", libelle: "Largeur de capuche", aide: "Capuche à plat, vue de côté, à l'endroit le plus large.", niveau: "recommande", defautM: 26, gradation: 0.5, min: 18, max: 40 },
    { cle: "poche_largeur", libelle: "Largeur de poche (bas)", aide: "Poche kangourou, largeur en bas.", niveau: "optionnel", defautM: 36, gradation: 1, min: 20, max: 60 },
    { cle: "poche_haut", libelle: "Largeur de poche (haut)", aide: "Poche kangourou, largeur du bord supérieur.", niveau: "optionnel", defautM: 26, gradation: 1, min: 10, max: 55 },
    { cle: "poche_hauteur", libelle: "Hauteur de poche", aide: "Du bord-côte jusqu'au haut de la poche.", niveau: "optionnel", defautM: 20, gradation: 0.5, min: 10, max: 35 },
    { cle: "cordon", libelle: "Longueur visible des cordons", aide: "De l'œillet jusqu'au bout de l'embout.", niveau: "optionnel", defautM: 32, gradation: 0, min: 0, max: 60 },
  ],
  dessiner,
  zones,
  controles,
  poignees,
};

export const _interne = { points };
