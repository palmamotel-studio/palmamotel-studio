import type { Gabarit, Mesures, Pose, Pt, Trace, Vue, Finitions, ZoneImpression, DefMesure, Famille } from "../moteur/types";
import { ligne, lisse, rayures, miroir, quad, Chemin } from "../moteur/geom";
import { lire, dessin, cubique } from "./commun";

/**
 * VAGUE 3 — bain et accessoires : bikini (haut, bas), casquette, bob, bonnet, tote bag, chaussettes.
 * Chaque pièce est un petit gabarit autonome. Unités : mm.
 */
const rond = (c: Pt, r: number) => `M ${c[0] - r} ${c[1]} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0`;
const M = (cle: string, libelle: string, aide: string, niveau: DefMesure["niveau"], defautM: number, gradation: number, min: number, max: number, cote?: DefMesure["cote"]): DefMesure =>
  ({ cle, libelle, aide, niveau, defautM, gradation, min, max, cote });

function simple(id: string, nom: string, famille: Famille, mesures: DefMesure[], dessiner: (m: Mesures, vue: Vue) => ReturnType<typeof dessin>, zones: (m: Mesures, vue: Vue) => ZoneImpression[], finitions: Gabarit["finitions"] = ["piqure"]): Gabarit {
  return {
    id, nom, famille, poseParDefaut: "ecartes", poses: ["ecartes"], finitions, mesures,
    dessiner: (m: Mesures, vue: Vue, _p: Pose, _f?: Finitions) => dessiner(m, vue),
    zones,
  };
}

/* ---------------- Bikini haut ---------------- */
export const bikiniHaut = simple("bikini_haut", "Bikini (haut)", "bain", [
  M("largeur_bonnet", "Largeur du bonnet", "À plat, à la base du triangle.", "obligatoire", 16, 1, 9, 26, (m) => { const g = lire(m, "ecart_bonnets", 20) / 2; const w = lire(m, "largeur_bonnet", 160); const h = lire(m, "hauteur_bonnet", 140); return { a: [g, h], b: [g + w, h], decalage: 14 }; }),
  M("hauteur_bonnet", "Hauteur du bonnet", "De la base à la pointe du triangle.", "obligatoire", 14, 1, 8, 24, (m) => { const g = lire(m, "ecart_bonnets", 20) / 2; const w = lire(m, "largeur_bonnet", 160); const h = lire(m, "hauteur_bonnet", 140); return { a: [g + w * 0.45, 0], b: [g + w * 0.45, h], decalage: -40 }; }),
  M("ecart_bonnets", "Écart entre les bonnets", "Au milieu devant, à la base.", "optionnel", 2, 0, 0, 10),
  M("longueur_liens", "Longueur visible des liens", "Liens de cou et de dos dessinés.", "optionnel", 22, 0, 5, 60),
], (m) => {
  const g = lire(m, "ecart_bonnets", 20) / 2, w = lire(m, "largeur_bonnet", 160), h = lire(m, "hauteur_bonnet", 140), lien = lire(m, "longueur_liens", 220);
  const t: Trace[] = [];
  [1, -1].forEach((s) => {
    const f = (q: number[]): Pt => (s === 1 ? [q[0], q[1]] : [-q[0], q[1]]);
    const apex: Pt = [g + w * 0.45, 0];
    const tri: Pt[] = [[g, h], [g + w, h], apex];
    t.push({ role: "accessoire", d: ligne([apex, [g + w * 0.3, -lien * 0.8]].map(f)), nom: "Lien de cou" });
    t.push({ role: "piece", d: lisse([[g, h], [g + w * 0.08, h * 0.5], apex, [g + w * 0.92, h * 0.55], [g + w, h]].map(f), true, 0.8), nom: "Bonnet" });
    t.push({ role: "surpiqure", d: ligne([[g + 6, h - 8], [g + w * 0.45, 12], [g + w - 6, h - 8]].map(f)), nom: "Surpiqûre bonnet" });
    t.push({ role: "pli", d: lisse([[g + w * 0.45, h * 0.15], [g + w * 0.5, h * 0.55], [g + w * 0.45, h * 0.95]].map(f)), nom: "Fronces" });
    void tri;
  });
  t.push({ role: "cote", d: ligne([[-(g + w + lien), h], [g + w + lien, h], [g + w + lien, h + 12], [-(g + w + lien), h + 12]], true), nom: "Bande de dessous" });
  return dessin(t, [[-(g + w + lien), -lien * 0.8], [g + w + lien, h + 20]]);
}, (m, vue) => vue === "face" ? [{ id: "bonnet", nom: "Bonnet gauche", vue, cx: lire(m, "ecart_bonnets", 20) / 2 + lire(m, "largeur_bonnet", 160) * 0.5, y: lire(m, "hauteur_bonnet", 140) * 0.45, l: 40, h: 40 }] : [], ["piqure"]);

/* ---------------- Bikini bas ---------------- */
export const bikiniBas = simple("bikini_bas", "Bikini (bas)", "bain", [
  M("demi_taille", "Demi-tour de taille", "À plat, en haut, sans étirer.", "obligatoire", 33, 2, 20, 50, (m) => { const w = lire(m, "demi_taille", 330) / 2; return { a: [-w, 0], b: [w, 0], decalage: -18 }; }),
  M("hauteur_devant", "Hauteur devant", "Du haut au bas de l'entrejambe, au milieu.", "obligatoire", 18, 0.5, 8, 30, (m) => ({ a: [0, 0], b: [0, lire(m, "hauteur_devant", 180)] })),
  M("hauteur_cote", "Hauteur sur le côté", "Hauteur de la bande sur la hanche.", "recommande", 6, 0.5, 1, 15),
  M("largeur_entrejambe", "Largeur d'entrejambe", "À plat, au plus étroit.", "optionnel", 7, 0.3, 4, 14),
], (m, vue) => {
  const w = lire(m, "demi_taille", 330) / 2, H = lire(m, "hauteur_devant", 180), hc = lire(m, "hauteur_cote", 60), gw = lire(m, "largeur_entrejambe", 70) / 2;
  const creux = vue === "face" ? 0.85 : 0.45;
  const droite: Pt[] = [[w, 0], [w, hc], ...quad([w, hc], [w * (1 - creux), hc + (H - hc) * 0.25], [gw, H], 10).slice(1)];
  const tour: Pt[] = [[-w, 0], [0, 6], ...droite, ...droite.map(miroir).reverse().slice(0, -1)];
  const t: Trace[] = [{ role: "piece", d: lisse(tour, true, 0.85), nom: "Culotte" }];
  t.push({ role: "surpiqure", d: lisse([[-w + 4, 6], [0, 12], [w - 4, 6]]), nom: "Surpiqûre taille" });
  t.push({ role: "surpiqure", d: lisse(droite.slice(1).map(([x, y]) => [x - 6, y - 2] as Pt)) + " " + lisse(droite.slice(1).map(([x, y]) => [-(x - 6), y - 2] as Pt)), nom: "Surpiqûre jambe" });
  t.push({ role: "pli", d: lisse([[-w * 0.3, H * 0.25], [0, H * 0.32], [w * 0.3, H * 0.25]]) });
  return dessin(t, tour);
}, (m, vue) => [{ id: "hanche", nom: "Hanche", vue, cx: lire(m, "demi_taille", 330) * 0.3, y: 12, l: 30, h: 30 }], ["piqure"]);

/* ---------------- Casquette ---------------- */
export const casquette = simple("casquette", "Casquette", "accessoires", [
  M("tour_tete", "Tour de tête", "Tour intérieur, au bandeau.", "obligatoire", 58, 1, 50, 64),
  M("hauteur_couronne", "Hauteur de couronne", "Du bandeau au bouton, devant.", "recommande", 11.5, 0, 8, 16, (m) => ({ a: [0, 0], b: [0, -lire(m, "hauteur_couronne", 115)], decalage: -60 })),
  M("longueur_visiere", "Longueur de visière", "Du bandeau au bord de la visière.", "recommande", 7.5, 0, 5, 10),
], (m, vue) => {
  const W = lire(m, "tour_tete", 580) * 0.345 / 1, Hc = lire(m, "hauteur_couronne", 115), Lv = lire(m, "longueur_visiere", 75);
  const hw = W / 2;
  const t: Trace[] = [];
  const couronne: Pt[] = [[-hw, 0], [-hw * 0.98, -Hc * 0.55], [-hw * 0.6, -Hc * 0.95], [0, -Hc], [hw * 0.6, -Hc * 0.95], [hw * 0.98, -Hc * 0.55], [hw, 0]];
  t.push({ role: "piece", d: lisse(couronne, true, 0.6), nom: "Couronne" });
  if (vue === "face") {
    t.push({ role: "couture", d: ligne([[0, -Hc], [0, 0]]), nom: "Couture devant" });
    t.push({ role: "surpiqure", d: ligne([[-5, -Hc + 6], [-5, -2]]) + " " + ligne([[5, -Hc + 6], [5, -2]]), nom: "Surpiqûre devant" });
    [-1, 1].forEach((s) => t.push({ role: "couture", d: lisse([[s * hw * 0.85, -2], [s * hw * 0.78, -Hc * 0.55], [s * hw * 0.35, -Hc * 0.96]]), nom: "Couture de panneau" }));
    [-1, 1].forEach((s) => t.push({ role: "accessoire", d: rond([s * hw * 0.55, -Hc * 0.68], 3), nom: "Œillet" }));
    const vis = lisse([[-hw * 1.02, 0], [-hw * 0.8, Lv * 0.42], [0, Lv * 0.55], [hw * 0.8, Lv * 0.42], [hw * 1.02, 0]], true, 0.6);
    t.push({ role: "piece", d: vis, nom: "Visière" });
    for (let i = 1; i <= 4; i++) t.push({ role: "surpiqure", d: lisse([[-hw * (1 - i * 0.03), i * 4], [0, Lv * 0.55 - (5 - i) * 2], [hw * (1 - i * 0.03), i * 4]], false, 0.6), nom: "Surpiqûres visière" });
  } else {
    const ouv: Pt[] = [[-hw * 0.32, 0], [-hw * 0.3, -Hc * 0.28], [0, -Hc * 0.36], [hw * 0.3, -Hc * 0.28], [hw * 0.32, 0]];
    t.push({ role: "interieur", d: lisse(ouv, true, 0.6), nom: "Ouverture arrière" });
    t.push({ role: "piece", d: ligne([[-hw * 0.45, -16], [hw * 0.45, -16], [hw * 0.45, 0], [-hw * 0.45, 0]], true), nom: "Fermeture snapback" });
    for (let i = 0; i < 6; i++) t.push({ role: "accessoire", d: rond([-hw * 0.35 + i * hw * 0.14, -8], 2.5), nom: "Pression" });
    t.push({ role: "couture", d: ligne([[0, -Hc], [0, -Hc * 0.36]]), nom: "Couture dos" });
    [-1, 1].forEach((s) => t.push({ role: "couture", d: lisse([[s * hw * 0.85, -2], [s * hw * 0.78, -Hc * 0.55], [s * hw * 0.35, -Hc * 0.96]]), nom: "Couture de panneau" }));
  }
  t.push({ role: "accessoire", d: rond([0, -Hc - 3], 6), nom: "Bouton de sommet" });
  return dessin(t, [[-hw * 1.05, -Hc - 10], [hw * 1.05, Lv * 0.6]]);
}, (m, vue) => {
  const W = lire(m, "tour_tete", 580) * 0.345, Hc = lire(m, "hauteur_couronne", 115);
  return vue === "face" ? [{ id: "devant", nom: "Panneau avant", vue, cx: 0, y: -Hc * 0.78, l: W * 0.55, h: Hc * 0.6 }] : [{ id: "arriere", nom: "Arrière", vue, cx: 0, y: -Hc * 0.85, l: W * 0.4, h: Hc * 0.4 }];
}, ["piqure"]);

/* ---------------- Bob ---------------- */
export const bob = simple("bob", "Bob", "accessoires", [
  M("tour_tete", "Tour de tête", "Tour intérieur, au bandeau.", "obligatoire", 58, 1, 50, 64),
  M("hauteur_couronne", "Hauteur de couronne", "Du bord au sommet.", "recommande", 8.5, 0, 5, 14, (m) => ({ a: [0, 0], b: [0, -lire(m, "hauteur_couronne", 85)], decalage: -80 })),
  M("largeur_bord", "Largeur du bord", "Largeur du bord tombant.", "recommande", 6, 0, 3, 10),
], (m) => {
  const W = lire(m, "tour_tete", 580) * 0.34, Hc = lire(m, "hauteur_couronne", 85), Lb = lire(m, "largeur_bord", 60);
  const hw = W / 2;
  const t: Trace[] = [];
  t.push({ role: "piece", d: lisse([[-hw, 0], [-hw * 0.92, -Hc * 0.85], [0, -Hc], [hw * 0.92, -Hc * 0.85], [hw, 0]], true, 0.75), nom: "Couronne" });
  t.push({ role: "couture", d: ligne([[-hw * 0.93, -Hc * 0.86], [hw * 0.93, -Hc * 0.86]]), nom: "Couture du dessus" });
  t.push({ role: "surpiqure", d: ligne([[-hw * 0.95, -6], [hw * 0.95, -6]]), nom: "Surpiqûre bandeau" });
  const bord: Pt[] = [[-hw, 0], [hw, 0], [hw + Lb * 1.1, Lb * 0.75], [0, Lb * 0.95], [-hw - Lb * 1.1, Lb * 0.75]];
  t.push({ role: "piece", d: lisse(bord, true, 0.7), nom: "Bord" });
  for (let i = 1; i <= 5; i++) {
    const k = i / 6;
    t.push({ role: "surpiqure", d: lisse([[-hw - Lb * 1.1 * k, Lb * 0.75 * k], [0, Lb * 0.95 * k + 2], [hw + Lb * 1.1 * k, Lb * 0.75 * k]], false, 0.7), nom: "Surpiqûres du bord" });
  }
  [-1, 1].forEach((s) => t.push({ role: "accessoire", d: rond([s * hw * 0.55, -Hc * 0.5], 3), nom: "Œillet" }));
  return dessin(t, [[-hw - Lb * 1.15, -Hc - 6], [hw + Lb * 1.15, Lb + 6]]);
}, (m, vue) => [{ id: "devant", nom: vue === "face" ? "Devant" : "Dos", vue, cx: 0, y: -lire(m, "hauteur_couronne", 85) * 0.7, l: lire(m, "tour_tete", 580) * 0.18, h: lire(m, "hauteur_couronne", 85) * 0.5 }]);

/* ---------------- Bonnet ---------------- */
export const bonnet = simple("bonnet", "Bonnet", "accessoires", [
  M("largeur", "Largeur à plat", "Au revers, à plat.", "obligatoire", 21, 0.5, 15, 30, (m) => { const w = lire(m, "largeur", 210) / 2; return { a: [-w, 0], b: [w, 0], decalage: 18 }; }),
  M("hauteur", "Hauteur totale", "Revers rabattu, du bas au sommet.", "obligatoire", 21, 0.5, 14, 32, (m) => ({ a: [0, 0], b: [0, -lire(m, "hauteur", 210)], decalage: -150 })),
  M("hauteur_revers", "Hauteur du revers", "Hauteur du revers rabattu.", "recommande", 7, 0, 0, 12),
], (m) => {
  const hw = lire(m, "largeur", 210) / 2, H = lire(m, "hauteur", 210), Hr = lire(m, "hauteur_revers", 70);
  const t: Trace[] = [];
  const corps: Pt[] = [[-hw * 0.97, -Hr + 4], [-hw * 0.98, -H * 0.7], [-hw * 0.7, -H * 0.97], [0, -H], [hw * 0.7, -H * 0.97], [hw * 0.98, -H * 0.7], [hw * 0.97, -Hr + 4]];
  t.push({ role: "cote", d: lisse(corps, true, 0.7), nom: "Corps" });
  const r = new Chemin();
  for (let x = -hw * 0.9; x <= hw * 0.9; x += 7) r.m([x, -Hr]).l([x * 0.92, -H * 0.88]);
  t.push({ role: "pli", d: r.toString(), nom: "Côtes du corps" });
  const rev: Pt[] = [[-hw, -Hr], [hw, -Hr], [hw, 0], [-hw, 0]];
  t.push({ role: "cote", d: ligne(rev, true), nom: "Revers" });
  t.push({ role: "pli", d: rayures([-hw, -Hr], [hw, -Hr], [-hw, 0], [hw, 0], 6), nom: "Côtes du revers" });
  t.push({ role: "couture", d: lisse([[-hw * 0.5, -H * 0.94], [0, -H * 0.86], [hw * 0.5, -H * 0.94]]), nom: "Fermeture du sommet" });
  return dessin(t, [[-hw, -H - 4], [hw, 4]]);
}, (m, vue) => [{ id: "revers", nom: "Revers", vue, cx: 0, y: -lire(m, "hauteur_revers", 70) + 10, l: Math.min(90, lire(m, "largeur", 210) * 0.5), h: Math.max(20, lire(m, "hauteur_revers", 70) - 20) }], ["cotes"]);

/* ---------------- Tote bag ---------------- */
export const tote = simple("tote", "Tote bag", "accessoires", [
  M("largeur", "Largeur", "À plat, en haut.", "obligatoire", 38, 0, 20, 60, (m) => { const w = lire(m, "largeur", 380) / 2; return { a: [-w, 0], b: [w, 0], decalage: -14 }; }),
  M("hauteur", "Hauteur", "Du haut au bas du sac.", "obligatoire", 42, 0, 20, 60, (m) => { const w = lire(m, "largeur", 380) / 2; return { a: [w, 0], b: [w, lire(m, "hauteur", 420)], decalage: -20 }; }),
  M("anses", "Longueur des anses", "Longueur totale d'une anse.", "recommande", 60, 0, 30, 130),
  M("largeur_anse", "Largeur des anses", "À plat.", "optionnel", 2.5, 0, 1, 6),
], (m) => {
  const hw = lire(m, "largeur", 380) / 2, H = lire(m, "hauteur", 420), La = lire(m, "anses", 600), la = lire(m, "largeur_anse", 25);
  const t: Trace[] = [];
  const ecart = hw * 0.42, haut = La / 2 - ecart * 0.5;
  const anse = (dx: number) => {
    const ext = cubique([-ecart - dx, 0], [-ecart - dx, -haut * 1.15], [ecart + dx, -haut * 1.15], [ecart + dx, 0], 24);
    return ext;
  };
  const a1 = anse(la / 2), a2 = anse(-la / 2);
  t.push({ role: "piece", d: ligne([...a1, ...[...a2].reverse()], true), nom: "Anse" });
  t.push({ role: "piece", d: ligne([[-hw, 0], [hw, 0], [hw, H], [-hw, H]], true), nom: "Sac" });
  t.push({ role: "surpiqure", d: ligne([[-hw + 2, 30], [hw - 2, 30]]), nom: "Ourlet du haut" });
  [-1, 1].forEach((s) => t.push({ role: "surpiqure", d: `M ${s * ecart - la / 2 - 2} 2 h ${la + 4} v 26 h ${-(la + 4)} Z M ${s * ecart - la / 2 - 2} 2 L ${s * ecart + la / 2 + 2} 28 M ${s * ecart + la / 2 + 2} 2 L ${s * ecart - la / 2 - 2} 28`, nom: "Renfort d'anse" }));
  t.push({ role: "pli", d: lisse([[-hw * 0.4, H * 0.2], [-hw * 0.45, H * 0.6], [-hw * 0.38, H * 0.95]]) });
  return dessin(t, [[-hw, -haut * 0.9], [hw, H]]);
}, (m, vue) => [{ id: "centre", nom: "Centre", vue, cx: 0, y: 70, l: Math.min(300, lire(m, "largeur", 380) - 60), h: Math.min(320, lire(m, "hauteur", 420) - 100) }]);

/* ---------------- Chaussettes ---------------- */
export const chaussettes = simple("chaussettes", "Chaussettes", "accessoires", [
  M("hauteur_tige", "Hauteur de tige", "Du haut de la chaussette au talon.", "obligatoire", 20, 1, 5, 40, (m) => ({ a: [0, 0], b: [0, lire(m, "hauteur_tige", 200)], decalage: 30 })),
  M("longueur_pied", "Longueur du pied", "Du talon au bout.", "obligatoire", 24, 1, 18, 30),
  M("largeur", "Largeur à plat", "Largeur de la tige à plat.", "recommande", 9, 0.3, 6, 12),
  M("hauteur_cote", "Hauteur du bord-côte", "Bande du haut.", "optionnel", 4, 0, 1, 10),
], (m, vue) => {
  const H = lire(m, "hauteur_tige", 200), Lp = lire(m, "longueur_pied", 240), w = lire(m, "largeur", 90), hc = lire(m, "hauteur_cote", 40);
  const s = vue === "face" ? 1 : -1;
  const f = (q: number[]): Pt => [q[0] * s, q[1]];
  const contour: Pt[] = [[-w / 2, 0], [w / 2, 0], [w / 2, H - w * 0.2], [w / 2 + Lp * 0.75, H - w * 0.1], [w / 2 + Lp - w * 0.45, H], [w / 2 + Lp - w * 0.4, H + w * 0.95], [-w / 2 + 6, H + w * 0.95], [-w / 2 - 10, H + w * 0.4], [-w / 2, H - w * 0.3]];
  const t: Trace[] = [{ role: "piece", d: lisse(contour.map(f), true, 0.85), nom: "Chaussette" }];
  t.push({ role: "cote", d: ligne([[-w / 2, 0], [w / 2, 0], [w / 2, hc], [-w / 2, hc]].map(f), true), nom: "Bord-côte" });
  t.push({ role: "pli", d: rayures(f([-w / 2, 0]), f([w / 2, 0]), f([-w / 2, hc]), f([w / 2, hc]), 3), nom: "Côtes du haut" });
  t.push({ role: "couture", d: lisse([[-w / 2 - 4, H - w * 0.35], [-w * 0.05, H + w * 0.15], [-w / 2 + 14, H + w * 0.93]].map(f)), nom: "Talon" });
  t.push({ role: "couture", d: lisse([[w / 2 + Lp - w * 1.2, H - w * 0.05], [w / 2 + Lp - w * 1.05, H + w * 0.5], [w / 2 + Lp - w * 1.2, H + w * 0.95]].map(f)), nom: "Pointe" });
  return dessin(t, contour.map(f));
}, (m, vue) => [{ id: "tige", nom: "Tige", vue, cx: 0, y: lire(m, "hauteur_cote", 40) + 15, l: lire(m, "largeur", 90) * 0.7, h: Math.max(30, lire(m, "hauteur_tige", 200) * 0.5) }], ["cotes"]);
