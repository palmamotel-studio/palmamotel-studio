import type { Gabarit, Mesures, Pose, Pt, Trace, Vue, Finitions, ZoneImpression, Alerte, Poignee, DefMesure, Famille } from "../moteur/types";
import { FINITIONS_DEFAUT } from "../moteur/types";
import { ligne, lisse, rayures, miroir, quad } from "../moteur/geom";
import { lire, dessin } from "./commun";

/**
 * CONSTRUCTEUR DE BAS (jogging, short, pantalon, cargo, short de bain).
 * Repère : x = 0 au milieu, y = 0 en haut de la ceinture, y vers le bas, en mm.
 * Longueur totale (côté) = montant + entrejambe.
 */
export interface ConfigBas {
  id: string;
  nom: string;
  famille: Famille;
  ceinture: "elastique_cordon" | "boutonnee";
  bas: "cote" | "ourlet";
  poches: ("cote" | "italiennes" | "cargo" | "arriere_plaquee" | "arriere_passepoil")[];
  braguette: boolean;
  passants: boolean;
  defauts: Record<string, number>;
}

function points(m: Mesures, cfg: ConfigBas) {
  const hw = lire(m, "demi_taille", 400) / 2;
  const hh = lire(m, "demi_hanches", 540) / 2;
  const montant = lire(m, "montant", 300);
  const entre = lire(m, "entrejambe", 760);
  const cuisse = lire(m, "largeur_cuisse", 320);
  const bas = lire(m, "largeur_bas", 200);
  const hc = lire(m, "hauteur_ceinture", 40);
  const hCote = cfg.bas === "cote" ? lire(m, "hauteur_cote_bas", 80) : 0;
  const Y = montant + entre;
  // À plat, la jambe s'évase légèrement sous les hanches (fourche).
  const xoC = Math.max(hh + 4, cuisse * 0.9);
  const xiC = Math.max(3, xoC - cuisse);
  const cc = (xoC + xiC) / 2;
  // Une jambe de jogging s'élargit légèrement au-dessus du bord-côte (blousant).
  const largeurAvantCote = cfg.bas === "cote" ? Math.min(cuisse * 0.75, bas * 1.45) : bas;
  const yH = montant * 0.55;
  return { hw, hh, montant, entre, cuisse, bas, hc, hCote, Y, xoC, xiC, cc, largeurAvantCote, yH };
}

function construire(cfg: ConfigBas) {
  function dessiner(m: Mesures, vue: Vue, _pose: Pose, f: Finitions = FINITIONS_DEFAUT) {
    void f;
    const p = points(m, cfg);
    const traces: Trace[] = [];
    const yAvantCote = p.Y - p.hCote;
    const lo = p.cc + p.largeurAvantCote / 2, li = p.cc - p.largeurAvantCote / 2;
    // Côté droit (vu de face) : taille → hanche → genou → bas, puis entrejambe jusqu'à la fourche.
    const hanche = quad([p.hw, 0], [p.hh * 1.01, p.yH * 0.75], [p.xoC, p.montant], 12);
    const fourche = quad([p.xiC, p.montant + 14], [p.xiC * 0.4, p.montant + 2], [0, p.montant], 6);
    const droite: Pt[] = [...hanche, [lo, yAvantCote], [li, yAvantCote], ...fourche];
    const tour: Pt[] = [...droite, ...droite.map(miroir).reverse().slice(1)];
    traces.push({ role: "piece", d: ligne(tour, true), nom: "Corps" });

    // Ceinture.
    const ceint: Pt[] = [[-p.hw, 0], [p.hw, 0], [p.hw + 1, p.hc], [-p.hw - 1, p.hc]];
    if (cfg.ceinture === "elastique_cordon") {
      traces.push({ role: "cote", d: ligne(ceint, true), nom: "Ceinture élastiquée" });
      for (let i = 1; i < 3; i++) traces.push({ role: "surpiqure", d: ligne([[-p.hw + 2, (p.hc * i) / 3], [p.hw - 2, (p.hc * i) / 3]]), nom: "Surpiqûres ceinture" });
      if (vue === "face") {
        [-1, 1].forEach((s) => {
          traces.push({ role: "accessoire", d: `M ${s * 22 - 4} ${p.hc / 2} a 4 4 0 1 0 8 0 a 4 4 0 1 0 -8 0`, nom: "Œillet" });
          traces.push({ role: "accessoire", d: `M ${s * 22} ${p.hc / 2} q ${s * 10} 60 ${s * 4} 130`, nom: "Cordon" });
          traces.push({ role: "accessoire", d: `M ${s * 22 + s * 4 - 3.5} ${p.hc / 2 + 130} h 7 v 24 h -7 Z`, nom: "Embout" });
        });
      }
    } else {
      traces.push({ role: "piece", d: ligne(ceint, true), nom: "Ceinture" });
      traces.push({ role: "surpiqure", d: ligne([[-p.hw + 2, p.hc - 4], [p.hw - 2, p.hc - 4]]), nom: "Surpiqûre ceinture" });
      if (vue === "face") traces.push({ role: "accessoire", d: `M -6 ${p.hc / 2} a 6 6 0 1 0 12 0 a 6 6 0 1 0 -12 0`, nom: "Bouton" });
      if (cfg.passants) {
        const xs = vue === "face" ? [-p.hw * 0.75, -p.hw * 0.3, p.hw * 0.3, p.hw * 0.75] : [-p.hw * 0.55, 0, p.hw * 0.55];
        xs.forEach((x) => traces.push({ role: "piece", d: ligne([[x - 5, -3], [x + 5, -3], [x + 5, p.hc + 6], [x - 5, p.hc + 6]], true), nom: "Passant" }));
      }
    }

    if (vue === "face") {
      if (cfg.braguette) {
        const yb = p.montant * 0.62;
        traces.push({ role: "surpiqure", d: `M 0 ${p.hc} L 0 ${yb} M -34 ${p.hc} L -34 ${yb - 30} Q -34 ${yb} -4 ${yb + 6}`, nom: "Braguette" });
        traces.push({ role: "couture", d: ligne([[0, p.hc], [0, p.montant]]), nom: "Milieu devant" });
      } else {
        traces.push({ role: "couture", d: ligne([[0, p.hc], [0, p.montant]]), nom: "Milieu devant" });
      }
      for (const po of cfg.poches) {
        [-1, 1].forEach((s) => {
          const fx = (q: number[]): Pt => (s === 1 ? [q[0], q[1]] : [-q[0], q[1]]);
          if (po === "cote") {
            traces.push({ role: "couture", d: ligne([[p.hw + 3, p.hc + 40], [p.hh - 3, p.yH + 60]].map(fx)), nom: "Poche côté" });
            traces.push({ role: "surpiqure", d: ligne([[p.hw - 6, p.hc + 40], [p.hh - 14, p.yH + 60]].map(fx)), nom: "Surpiqûre poche" });
          }
          if (po === "italiennes") {
            const ouv = quad([p.hw - 70, p.hc], [p.hw - 55, p.hc + 90], [p.hh - 2, p.hc + 150], 10);
            traces.push({ role: "couture", d: lisse(ouv.map(fx)), nom: "Poche italienne" });
            traces.push({ role: "surpiqure", d: lisse(ouv.map(([x, y]) => [x - 7, y + 4] as Pt).map(fx)), nom: "Surpiqûre poche" });
          }
          if (po === "cargo") {
            const x0 = p.xoC - 6 - 150, y0 = p.montant + 110;
            traces.push({ role: "piece", d: ligne([[x0, y0 + 20], [x0 + 150, y0 + 20], [x0 + 150, y0 + 200], [x0, y0 + 200]].map(fx), true), nom: "Poche cargo" });
            traces.push({ role: "piece", d: ligne([[x0 - 4, y0], [x0 + 154, y0], [x0 + 154, y0 + 55], [x0 - 4, y0 + 55]].map(fx), true), nom: "Rabat cargo" });
            traces.push({ role: "surpiqure", d: ligne([[x0, y0 + 6], [x0 + 150, y0 + 6]].map(fx)) + " " + ligne([[x0 + 75, y0 + 20], [x0 + 75, y0 + 200]].map(fx)), nom: "Surpiqûre cargo" });
            traces.push({ role: "accessoire", d: `M ${fx([x0 + 75, y0 + 40])[0] - 6} ${y0 + 40} a 6 6 0 1 0 12 0 a 6 6 0 1 0 -12 0`, nom: "Pression" });
          }
        });
      }
    } else {
      traces.push({ role: "couture", d: ligne([[0, p.hc], [0, p.montant]]), nom: "Milieu dos" });
      if (cfg.ceinture === "boutonnee") {
        const emp = lisse([[-p.hw - 2, p.hc + 60], [0, p.hc + 25], [p.hw + 2, p.hc + 60]], false, 0.9);
        traces.push({ role: "couture", d: emp, nom: "Empiècement dos" });
      }
      for (const po of cfg.poches) {
        if (po === "arriere_plaquee" || po === "arriere_passepoil") {
          [-1, 1].forEach((s) => {
            const cx = s * p.hw * 0.5, y = p.hc + 80, l = 130;
            if (po === "arriere_plaquee") {
              const poche: Pt[] = [[cx - l / 2, y], [cx + l / 2, y], [cx + l / 2 - 4, y + 140], [cx, y + 158], [cx - l / 2 + 4, y + 140]];
              traces.push({ role: "piece", d: ligne(poche, true), nom: "Poche arrière" });
              traces.push({ role: "surpiqure", d: ligne([[cx - l / 2 + 4, y + 6], [cx + l / 2 - 4, y + 6]]), nom: "Surpiqûre poche" });
            } else {
              traces.push({ role: "piece", d: ligne([[cx - l / 2, y], [cx + l / 2, y], [cx + l / 2, y + 12], [cx - l / 2, y + 12]], true), nom: "Poche passepoilée" });
            }
          });
        }
      }
    }

    // Bas de jambe.
    [1, -1].forEach((s) => {
      const fx = (q: number[]): Pt => (s === 1 ? [q[0], q[1]] : [-q[0], q[1]]);
      if (cfg.bas === "cote") {
        const c: Pt[] = [[p.cc - p.bas / 2, yAvantCote], [p.cc + p.bas / 2, yAvantCote], [p.cc + p.bas / 2, p.Y], [p.cc - p.bas / 2, p.Y]];
        traces.push({ role: "cote", d: ligne(c.map(fx), true), nom: "Bord-côte de jambe" });
        traces.push({ role: "pli", d: rayures(fx(c[0]), fx(c[1]), fx(c[3]), fx(c[2]), 3.5), nom: "Côtes de jambe" });
        for (let i = 1; i <= 3; i++) {
          const x = li + ((lo - li) * i) / 4;
          traces.push({ role: "pli", d: lisse([fx([x, yAvantCote]), fx([x + 2, yAvantCote - 28]), fx([x - 1, yAvantCote - 50])]) });
        }
      } else {
        traces.push({ role: "surpiqure", d: ligne([fx([li + 1, p.Y - 25]), fx([lo - 1, p.Y - 25])]), nom: "Ourlet" });
      }
      // Plis de genou et d'aine.
      const yG = p.montant + p.entre * 0.42;
      traces.push({ role: "pli", d: lisse([fx([p.cc - 30, yG]), fx([p.cc, yG + 14]), fx([p.cc + 28, yG + 4])]) });
      traces.push({ role: "pli", d: lisse([fx([p.xiC + 8, p.montant + 20]), fx([p.xiC + 40, p.montant + 50]), fx([p.xiC + 60, p.montant + 90])]) });
    });

    return dessin(traces, [...tour, [-p.hw, -4], [p.hw, -4]]);
  }

  function zones(m: Mesures, vue: Vue): ZoneImpression[] {
    const p = points(m, cfg);
    if (vue === "face")
      return [
        { id: "hanche", nom: "Hanche gauche", vue, cx: p.hw * 0.55, y: p.hc + 30, l: 80, h: 80 },
        { id: "jambe", nom: "Le long de la jambe", vue, cx: -p.cc, y: p.montant + 60, l: Math.min(90, p.bas * 0.8), h: Math.min(400, p.entre * 0.6) },
      ];
    return [
      { id: "ceinture", nom: "Ceinture dos", vue, cx: 0, y: 4, l: Math.min(140, p.hw), h: Math.max(10, p.hc - 8) },
      { id: "fessier", nom: "Arrière", vue, cx: p.hw * 0.5, y: p.hc + 60, l: 90, h: 90 },
    ];
  }

  function controles(m: Mesures): Alerte[] {
    const a: Alerte[] = [];
    if (m.demi_taille > m.demi_hanches * 1.05) a.push({ cle: "demi_taille", message: "La taille est plus large que les hanches." });
    if (m.largeur_bas > m.largeur_cuisse) a.push({ cle: "largeur_bas", message: "Le bas de jambe est plus large que la cuisse." });
    if (m.montant > m.entrejambe * 2.5 && m.entrejambe > 200) a.push({ cle: "montant", message: "Montant très grand par rapport à l'entrejambe." });
    return a;
  }

  function poignees(m: Mesures): Poignee[] {
    const p = points(m, cfg);
    return [
      { cle: "entrejambe", pos: [p.cc, p.Y], axe: [0, 1], facteur: 1 },
      { cle: "demi_hanches", pos: [p.hh, p.yH], axe: [1, 0], facteur: 2 },
      { cle: "largeur_cuisse", pos: [p.xoC, p.montant], axe: [1, 0], facteur: 1 },
      { cle: "montant", pos: [0, p.montant], axe: [0, 1], facteur: 1 },
    ];
  }
  return { dessiner, zones, controles, poignees };
}

function mesures(cfg: ConfigBas): DefMesure[] {
  const D = cfg.defauts;
  const P = (m: Mesures) => points(m, cfg);
  const l: (DefMesure | false)[] = [
    { cle: "demi_taille", libelle: "Demi-tour de taille", aide: "À plat, en haut de la ceinture, sans étirer.", niveau: "obligatoire", defautM: D.demi_taille, gradation: 2.5, min: 25, max: 70,
      cote: (m) => { const p = P(m); return { a: [-p.hw, 0], b: [p.hw, 0], decalage: -22 }; } },
    { cle: "demi_hanches", libelle: "Demi-tour de hanches", aide: "À plat, au plus large, environ 18 cm sous la ceinture.", niveau: "recommande", defautM: D.demi_hanches, gradation: 2.5, min: 35, max: 80,
      cote: (m) => { const p = P(m); return { a: [-p.hh, p.yH], b: [p.hh, p.yH] }; } },
    { cle: "montant", libelle: "Montant devant", aide: "Du haut de la ceinture jusqu'à la fourche, au milieu devant.", niveau: "obligatoire", defautM: D.montant, gradation: 0.75, min: 15, max: 45,
      cote: (m) => ({ a: [0, 0], b: [0, P(m).montant], decalage: 0 }) },
    { cle: "entrejambe", libelle: "Entrejambe", aide: "De la fourche jusqu'au bas, le long de la couture intérieure.", niveau: "obligatoire", defautM: D.entrejambe, gradation: 1, min: 3, max: 95,
      cote: (m) => { const p = P(m); return { a: [p.xiC + 6, p.montant], b: [p.cc - p.bas / 2 + 6, p.Y] }; } },
    { cle: "largeur_cuisse", libelle: "Largeur de cuisse", aide: "À plat, 2,5 cm sous la fourche.", niveau: "recommande", defautM: D.largeur_cuisse, gradation: 1, min: 18, max: 50,
      cote: (m) => { const p = P(m); return { a: [p.xiC, p.montant + 25], b: [p.xoC, p.montant + 25] }; } },
    { cle: "largeur_bas", libelle: cfg.bas === "cote" ? "Largeur du bord-côte de jambe" : "Largeur du bas de jambe", aide: "À plat, au bas de la jambe.", niveau: "recommande", defautM: D.largeur_bas, gradation: 0.5, min: 8, max: 45,
      cote: (m) => { const p = P(m); return { a: [p.cc - p.bas / 2, p.Y], b: [p.cc + p.bas / 2, p.Y], decalage: 22 }; } },
    { cle: "hauteur_ceinture", libelle: "Hauteur de ceinture", aide: "Hauteur de la bande de ceinture.", niveau: "optionnel", defautM: D.hauteur_ceinture ?? 4, gradation: 0, min: 2, max: 10 },
    cfg.bas === "cote" && { cle: "hauteur_cote_bas", libelle: "Hauteur des bords-côtes de jambe", aide: "Hauteur de la bande en bas.", niveau: "optionnel", defautM: 8, gradation: 0, min: 3, max: 15 },
  ];
  return l.filter(Boolean) as DefMesure[];
}

export function creerBas(cfg: ConfigBas): Gabarit {
  return {
    id: cfg.id, nom: cfg.nom, famille: cfg.famille,
    poseParDefaut: "ecartes", poses: ["ecartes"],
    finitions: ["piqure", ...(cfg.bas === "cote" || cfg.ceinture === "elastique_cordon" ? (["cotes"] as const) : []), ...(cfg.ceinture === "elastique_cordon" ? (["cordon", "embout", "oeillet"] as const) : [])],
    mesures: mesures(cfg),
    ...construire(cfg),
  };
}

export const jogging = creerBas({
  id: "jogging", nom: "Jogging", famille: "bas", ceinture: "elastique_cordon", bas: "cote", poches: ["cote", "arriere_plaquee"], braguette: false, passants: false,
  defauts: { demi_taille: 38, demi_hanches: 54, montant: 31, entrejambe: 74, largeur_cuisse: 33, largeur_bas: 12, hauteur_ceinture: 4.5 },
});
export const short = creerBas({
  id: "short", nom: "Short", famille: "bas", ceinture: "elastique_cordon", bas: "ourlet", poches: ["cote", "arriere_plaquee"], braguette: false, passants: false,
  defauts: { demi_taille: 38, demi_hanches: 56, montant: 32, entrejambe: 18, largeur_cuisse: 34, largeur_bas: 33, hauteur_ceinture: 4 },
});
export const pantalon = creerBas({
  id: "pantalon", nom: "Pantalon droit", famille: "bas", ceinture: "boutonnee", bas: "ourlet", poches: ["italiennes", "arriere_passepoil"], braguette: true, passants: true,
  defauts: { demi_taille: 42, demi_hanches: 52, montant: 29, entrejambe: 80, largeur_cuisse: 32, largeur_bas: 21, hauteur_ceinture: 4 },
});
export const cargo = creerBas({
  id: "cargo", nom: "Cargo", famille: "bas", ceinture: "boutonnee", bas: "ourlet", poches: ["italiennes", "cargo", "arriere_plaquee"], braguette: true, passants: true,
  defauts: { demi_taille: 42, demi_hanches: 55, montant: 30, entrejambe: 78, largeur_cuisse: 35, largeur_bas: 23, hauteur_ceinture: 4 },
});
export const shortBain = creerBas({
  id: "short_bain", nom: "Short de bain", famille: "bain", ceinture: "elastique_cordon", bas: "ourlet", poches: ["cote", "arriere_plaquee"], braguette: false, passants: false,
  defauts: { demi_taille: 37, demi_hanches: 56, montant: 30, entrejambe: 11, largeur_cuisse: 34, largeur_bas: 33, hauteur_ceinture: 3.5 },
});
