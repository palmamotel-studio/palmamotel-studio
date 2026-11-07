import type { Gabarit, Mesures, Pose, Pt, Trace, Vue, ZoneImpression, Alerte, Poignee, DefMesure, Famille, Finitions } from "../moteur/types";
import { FINITIONS_DEFAUT } from "../moteur/types";
import { add, mul, dir, perp, ligne, lisse, decaler, rayures, lerp, sub, norm, quad, miroir, Chemin } from "../moteur/geom";
import { lire, dessin, cubique, encolure } from "./commun";

/**
 * CONSTRUCTEUR DE HAUTS À MANCHES LONGUES
 * (sweat, hoodie, hoodie zippé, manches longues, toutes les vestes).
 *
 * Un vêtement = une configuration : col, fermeture, poches, poignets, bas, détails.
 * Repère : x = 0 au milieu, y = 0 au point haut d'épaule (HPS), y vers le bas, en mm.
 */
export interface ConfigHaut {
  id: string;
  nom: string;
  famille: Famille;
  col: "rond" | "capuche" | "cagoule" | "montant" | "chemise" | "bomber";
  ouverture: "aucune" | "zip" | "pressions" | "boutons";
  poches: ("kangourou" | "laterales_zip" | "passepoil" | "rabat" | "poitrine_rabat" | "manche_zip")[];
  poignet: "cote" | "ourlet" | "elastique" | "bouton";
  bas: "cote" | "ourlet" | "cordon" | "ceinture";
  details?: { matelassage?: boolean; bandes?: boolean; empiecement?: boolean; froncesManche?: boolean };
  /** Valeurs en taille M propres à ce vêtement (cm). */
  defauts?: Record<string, number>;
}

type Geo = ReturnType<typeof points>;

export function points(m: Mesures, pose: Pose, cfg: Pick<ConfigHaut, "poignet" | "bas">) {
  const demiPoitrine = lire(m, "demi_poitrine", 580) / 2;
  const L = lire(m, "longueur", 700);
  const demiEpaules = lire(m, "epaules", 540) / 2;
  const manche = lire(m, "manche", 620);
  const emmanchure = lire(m, "emmanchure", 270);
  const biceps = lire(m, "largeur_manche", 230);
  const poignet = lire(m, "poignet", 95);
  const bande = cfg.poignet === "cote" || cfg.poignet === "bouton";
  const hPoignet = bande ? lire(m, "hauteur_poignet", 70) : 0;
  const coteBas = cfg.bas === "cote" || cfg.bas === "ceinture";
  const hBas = coteBas ? lire(m, "hauteur_bas", 70) : 0;
  const demiBas = lire(m, "largeur_bas", 480) / 2;
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
  let I0: Pt;
  if (pose === "ecartes") {
    // La manche rejoint le corps sur le côté, à la largeur de biceps voulue.
    const t = Math.max(0, (UA[0] - SP[0] - n[0] * biceps) / Math.max(0.2, u[0]));
    I0 = add(add(SP, mul(n, biceps)), mul(u, Math.min(t, manche * 0.4)));
    I0 = [Math.max(I0[0], UA[0] - 4), Math.max(I0[1], UA[1])];
  } else {
    // Bras le long du corps : la manche recouvre le côté du corps.
    I0 = [UA[0] - biceps * 0.28, UA[1] + 10];
  }
  // Bout de manche : froncé au-dessus d'un poignet en bande, sinon droit.
  const A = add(SP, mul(u, manche - hPoignet));
  const largeurBout = bande ? Math.min(biceps * 0.85, poignet * 1.4) : cfg.poignet === "elastique" ? Math.min(biceps * 0.8, poignet * 1.25) : poignet;
  const F = add(A, mul(n, largeurBout));
  const mil = lerp(A, F, 0.5);
  const tAF = norm(sub(F, A));
  const B = add(mil, mul(tAF, -poignet / 2));
  const E = add(mil, mul(tAF, poignet / 2));
  const C = add(B, mul(u, hPoignet));
  const D = add(E, mul(u, hPoignet));

  const yCote = L - hBas;
  // Corps au-dessus d'un bord-côte : légèrement blousant. Sans bord-côte : le bas a la largeur mesurée.
  const demiCorps = coteBas ? Math.max(demiBas + 25, demiPoitrine - 8) : demiBas;
  return { HPS, SP, UA, I0, A, F, B, C, D, E, u, n, L, yCote, demiCorps, demiBas, pente, angle, demiEncolure, bande, coteBas, hPoignet };
}

const f2 = (s: number) => (q: Pt): Pt => (s === 1 ? q : miroir(q));
const rond = (c: Pt, r: number) => `M ${c[0] - r} ${c[1]} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0`;

/* ------------------------------------------------------------------ */
function construire(cfg: ConfigHaut) {
  const aCapuche = cfg.col === "capuche" || cfg.col === "cagoule";

  function capuche(m: Mesures, demiEnc: number) {
    const H = lire(m, "hauteur_capuche", 360);
    const W = lire(m, "largeur_capuche", 260) * 1.1;
    const base: Pt = [demiEnc + 22, 18];
    const droite: Pt[] = [base, [W / 2, -H * 0.3], [W * 0.4, -H * 0.78], [W * 0.12, -H * 0.99]];
    const tour: Pt[] = [...droite, [0, -H], ...droite.map(miroir).reverse()];
    return { H, W, tour };
  }

  /** Vue de profil : corps vu de côté, manche tombante, capuche ou col de profil. */
  function dessinerProfil(m: Mesures, fin: Finitions) {
    const p = points(m, "le_long", cfg);
    const t: Trace[] = [];
    const D = lire(m, "demi_poitrine", 580) * 0.42;
    const yB = p.coteBas ? p.yCote : p.L;
    const corps: Pt[] = [[-D * 0.42, p.pente * 0.6], [-D * 0.5, p.UA[1]], [-D * 0.5, yB], [D * 0.5, yB], [D * 0.52, p.UA[1]], [D * 0.4, p.pente * 0.4], [0, -4]];
    t.push({ role: "piece", d: lisse(corps, true, 0.7), nom: "Corps" });
    if (p.coteBas) {
      const c: Pt[] = [[-D * 0.47, p.yCote], [D * 0.47, p.yCote], [D * 0.46, p.L], [-D * 0.46, p.L]];
      t.push({ role: cfg.bas === "cote" ? "cote" : "piece", d: ligne(c, true), nom: "Bas" });
      if (cfg.bas === "cote") t.push({ role: "pli", d: rayures(c[0], c[1], c[3], c[2], 4), nom: "Côtes bas" });
    } else t.push({ role: "surpiqure", d: ligne([[-D * 0.48, p.L - 22], [D * 0.48, p.L - 22]]), nom: "Ourlet bas" });
    if (cfg.ouverture !== "aucune") t.push({ role: "accessoire", d: ligne([[-D * 0.5 + 3, 30], [-D * 0.5 + 3, p.L]]), nom: "Zip" });
    if (cfg.poches.includes("kangourou")) {
      const ph = lire(m, "poche_hauteur", 200);
      t.push({ role: "couture", d: lisse([[-D * 0.5, yB - ph], [-D * 0.5 + 34, yB - ph + 30], [-D * 0.5 + 40, yB]]), nom: "Poche kangourou" });
    }
    // Manche tombante.
    const biceps = lire(m, "largeur_manche", 230);
    const yFin = p.pente + lire(m, "manche", 620) * 0.96;
    const yPoignet = yFin - p.hPoignet;
    const bout = p.bande || cfg.poignet === "elastique" ? Math.min(biceps * 0.85, lire(m, "poignet", 95) * 1.4) : lire(m, "poignet", 95);
    const manche: Pt[] = [[-biceps * 0.42, p.pente + 40], [-biceps * 0.3, p.pente - 6], [biceps * 0.3, p.pente - 6], [biceps * 0.45, p.pente + 50], [bout * 0.55, yPoignet], [-bout * 0.45, yPoignet]];
    t.push({ role: "piece", d: lisse(manche, true, 0.75), nom: "Manche" });
    t.push({ role: "ombre", d: lisse([[biceps * 0.3, p.pente + 120], [biceps * 0.42, p.pente + 200], [bout * 0.5, yPoignet - 30], [bout * 0.3, yPoignet - 40]], true, 0.5) });
    t.push({ role: "pli", d: lisse([[-biceps * 0.2, p.pente + 200], [-biceps * 0.05, p.pente + 260], [biceps * 0.15, p.pente + 300]]) });
    if (p.bande) {
      const pw = lire(m, "poignet", 95);
      const c: Pt[] = [[-pw * 0.45, yPoignet], [pw * 0.55, yPoignet], [pw * 0.5, yFin], [-pw * 0.4, yFin]];
      t.push({ role: "cote", d: ligne(c, true), nom: "Poignet" });
      t.push({ role: "pli", d: rayures(c[0], c[1], c[3], c[2], 3.5), nom: "Côtes poignet" });
    } else t.push({ role: "surpiqure", d: ligne([[-bout * 0.42, yPoignet - 20], [bout * 0.52, yPoignet - 20]]), nom: "Ourlet de manche" });
    // Col / capuche de profil.
    if (cfg.col === "capuche" || cfg.col === "cagoule") {
      const H = lire(m, "hauteur_capuche", 360), W = lire(m, "largeur_capuche", 260) * 1.3;
      const cap: Pt[] = [[-D * 0.34, 50], [-W * 0.42, -H * 0.35], [-W * 0.38, -H * 0.9], [W * 0.05, -H], [W * 0.5, -H * 0.62], [W * 0.48, -H * 0.12], [D * 0.42, 55]];
      t.push({ role: "piece", d: lisse(cap, true, 0.7), nom: "Capuche" });
      const ouv: Pt[] = [[-W * 0.42, -H * (cfg.col === "cagoule" ? 0.62 : 0.35)], [-W * 0.18, -H * (cfg.col === "cagoule" ? 0.66 : 0.45)], [-W * 0.12, -H * (cfg.col === "cagoule" ? 0.74 : 0.62)], [-W * 0.4, -H * (cfg.col === "cagoule" ? 0.8 : 0.85)]];
      t.push({ role: "interieur", d: lisse(ouv, true, 0.6), nom: "Ouverture capuche" });
      t.push({ role: "surpiqure", d: lisse(cap.slice(1, 5).map(([x, y]) => [x * 0.9, y * 0.94] as Pt)), nom: "Surpiqûre capuche" });
    } else if (cfg.col === "montant" || cfg.col === "bomber") {
      const h = lire(m, "hauteur_col", 60);
      const c: Pt[] = [[-D * 0.32, 8], [-D * 0.3, -h], [D * 0.3, -h + 6], [D * 0.36, 10]];
      t.push({ role: cfg.col === "bomber" ? "cote" : "piece", d: lisse(c, true, 0.8), nom: "Col" });
    } else if (cfg.col === "chemise") {
      t.push({ role: "piece", d: lisse([[-D * 0.34, 12], [-D * 0.28, -24], [D * 0.3, -18], [D * 0.36, 30], [-D * 0.1, 40], [-D * 0.3, 70]], true, 0.75), nom: "Col" });
    } else {
      t.push({ role: "cote", d: lisse([[-D * 0.34, 4], [0, -10], [D * 0.36, 4], [D * 0.34, 22], [0, 10], [-D * 0.32, 24]], true, 0.75), nom: "Col" });
    }
    void fin;
    return dessin(t, [...corps, ...manche, [0, -lire(m, "hauteur_capuche", 0) - 10], [0, Math.max(p.L, yFin) + 4], [-D * 0.6, 0], [D * 0.6, 0]]);
  }

  function dessiner(m: Mesures, vue: Vue, pose: Pose, fin: Finitions = FINITIONS_DEFAUT) {
    if (vue === "profil") return dessinerProfil(m, fin);
    const p = points(m, pose, cfg);
    const dE = p.demiEncolure;
    const traces: Trace[] = [];
    const temoins: Pt[] = [];
    const ouvert = cfg.ouverture !== "aucune" && vue === "face";
    const det = cfg.details || {};

    // ---------- Corps ----------
    let cDroit: Pt[];
    if (p.coteBas) {
      const basCorps = quad([p.demiCorps, p.yCote - 30], [p.demiCorps * 0.98, p.yCote], [p.demiBas, p.yCote], 8);
      cDroit = [p.HPS, p.SP, p.UA, [p.demiCorps, p.yCote - 30], ...basCorps.slice(1)];
    } else {
      cDroit = [p.HPS, p.SP, p.UA, [p.demiCorps, p.L]];
    }
    const cGauche = cDroit.map(miroir).reverse();
    const profEnc = vue === "face" ? (cfg.col === "rond" ? lire(m, "prof_encolure_devant", 80) : 40) : 20;
    const enc = encolure(dE, profEnc);
    const corps: Pt[] = [...cDroit, ...cGauche, ...enc.slice(1, -1)];
    traces.push({ role: "piece", d: ligne(corps, true), nom: "Corps" });
    temoins.push(...corps);

    // ---------- Bas ----------
    const yB = p.coteBas ? p.yCote : p.L;
    if (p.coteBas) {
      const cote: Pt[] = [[-p.demiBas, p.yCote], [p.demiBas, p.yCote], [p.demiBas - 3, p.L], [-p.demiBas + 3, p.L]];
      if (cfg.bas === "cote") {
        traces.push({ role: "cote", d: ligne(cote, true), nom: "Bord-côte bas" });
        traces.push({ role: "pli", d: rayures(cote[0], cote[1], cote[3], cote[2], 4), nom: "Côtes bas" });
      } else {
        // Ceinture (veste en jean) : bande pleine, double surpiqûre, boutons de réglage.
        traces.push({ role: "piece", d: ligne(cote, true), nom: "Ceinture" });
        traces.push({ role: "surpiqure", d: ligne([[-p.demiBas + 3, p.yCote + 5], [p.demiBas - 3, p.yCote + 5]]) + " " + ligne([[-p.demiBas + 3, p.L - 5], [p.demiBas - 3, p.L - 5]]), nom: "Surpiqûre ceinture" });
        [-1, 1].forEach((s) => traces.push({ role: "accessoire", d: rond([s * (p.demiBas - 45), (p.yCote + p.L) / 2], 7), nom: "Bouton de réglage" }));
      }
      traces.push({ role: "surpiqure", d: ligne([[-p.demiBas + 2, p.yCote - 5], [p.demiBas - 2, p.yCote - 5]]), nom: "Surpiqûre bas" });
      temoins.push(...cote);
    } else {
      const h = cfg.bas === "cordon" ? 28 : 22;
      traces.push({ role: "surpiqure", d: ligne([[-p.demiBas + 2, p.L - h], [p.demiBas - 2, p.L - h]]), nom: cfg.bas === "cordon" ? "Coulisse" : "Ourlet bas" });
      if (cfg.bas === "cordon" && vue === "face") {
        [-1, 1].forEach((s) => {
          const x = s * (p.demiBas - 18);
          traces.push({ role: "accessoire", d: `M ${x} ${p.L - 14} q ${s * 10} 40 ${s * 4} 80`, nom: "Cordon de bas" });
          traces.push({ role: "accessoire", d: `M ${x + s * 4 - 7} ${p.L + 64} h 14 v 22 h -14 Z`, nom: "Stop-cordon" });
          temoins.push([x, p.L + 90]);
        });
      }
    }

    // ---------- Détails du corps ----------
    if (det.empiecement) {
      // Veste en jean : empiècement d'épaules et coutures verticales avec double surpiqûre.
      const y = vue === "face" ? 150 : 170;
      const emp = vue === "face" ? ligne([[-p.demiCorps, y], [p.demiCorps, y]]) : lisse([[-p.demiCorps, y], [0, y + 70], [p.demiCorps, y]], false, 0.9);
      traces.push({ role: "couture", d: emp, nom: "Empiècement" });
      traces.push({ role: "surpiqure", d: vue === "face" ? ligne([[-p.demiCorps, y + 6], [p.demiCorps, y + 6]]) : lisse([[-p.demiCorps, y + 6], [0, y + 76], [p.demiCorps, y + 6]], false, 0.9), nom: "Surpiqûre empiècement" });
      [-1, 1].forEach((s) => {
        const x = s * p.demiCorps * 0.45;
        traces.push({ role: "couture", d: ligne([[x, y + (vue === "dos" ? 40 : 0)], [x, yB]]), nom: "Couture de panneau" });
        traces.push({ role: "surpiqure", d: ligne([[x + 6, y + (vue === "dos" ? 40 : 0)], [x + 6, yB]]), nom: "Surpiqûre panneau" });
      });
    }
    if (det.matelassage) {
      // Doudoune : coutures de matelassage horizontales.
      const pas = 110;
      for (let y = 150; y < yB - 30; y += pas) traces.push({ role: "couture", d: ligne([[-p.demiCorps, y], [p.demiCorps, y]]), nom: "Matelassage" });
    }

    // ---------- Fermeture ----------
    if (ouvert) {
      const yHaut = cfg.col === "cagoule" ? -lire(m, "hauteur_capuche", 360) * 0.62 : cfg.col === "montant" || cfg.col === "bomber" ? -lire(m, "hauteur_col", 60) : profEnc;
      if (cfg.ouverture === "zip") {
        traces.push({ role: "accessoire", d: ligne([[-3.5, yHaut], [-3.5, p.L]]) + " " + ligne([[3.5, yHaut], [3.5, p.L]]), nom: "Zip" });
        if (fin.zip !== "invisible") {
          const dents = new Chemin();
          for (let y = yHaut + 4; y < p.L - 2; y += 4) dents.m([-3.5, y]).l([3.5, y + 2]);
          traces.push({ role: "couture", d: dents.toString(), nom: "Dents du zip" });
        }
        traces.push({ role: "surpiqure", d: ligne([[-10, yHaut + 6], [-10, p.L - 4]]) + " " + ligne([[10, yHaut + 6], [10, p.L - 4]]), nom: "Surpiqûre zip" });
        traces.push({ role: "accessoire", d: `M -6 ${yHaut + 8} h 12 v 30 h -12 Z`, nom: "Tirette" });
      } else {
        // Patte de boutonnage / pressions.
        traces.push({ role: "couture", d: ligne([[-16, profEnc], [-16, yB]]) + " " + ligne([[16, profEnc], [16, yB]]), nom: "Patte de boutonnage" });
        traces.push({ role: "surpiqure", d: ligne([[-10, profEnc + 4], [-10, yB - 4]]), nom: "Surpiqûre patte" });
        const nb = 5;
        for (let i = 0; i < nb; i++) {
          const y = profEnc + 30 + ((yB - profEnc - 70) * i) / (nb - 1);
          traces.push({ role: "accessoire", d: rond([0, y], cfg.ouverture === "pressions" ? 7 : 6), nom: cfg.ouverture === "pressions" ? "Pression" : "Bouton" });
        }
      }
    }

    // ---------- Poches ----------
    if (vue === "face") {
      for (const po of cfg.poches) {
        if (po === "kangourou") {
          const lb = lire(m, "poche_largeur", 360) / 2, lh = lire(m, "poche_haut", 260) / 2, ph = lire(m, "poche_hauteur", 200);
          const yb = yB, yt = yB - ph;
          const ouv = quad([-lh, yt], [-lb + 4, yt + ph * 0.25], [-lb, yb - 4], 10);
          const poche: Pt[] = [[-lh, yt], [lh, yt], ...ouv.map(miroir).slice(1), [lb, yb], [-lb, yb], ...ouv.slice(0, -1).reverse()];
          traces.push({ role: "piece", d: ligne(poche, true), nom: "Poche kangourou" });
          traces.push({ role: "surpiqure", d: ligne(decaler(ouv, -6)) + " " + ligne(decaler(ouv.map(miroir), 6)), nom: "Surpiqûre poche" });
          traces.push({ role: "surpiqure", d: ligne([[-lh + 6, yt + 6], [lh - 6, yt + 6]]), nom: "Surpiqûre poche" });
        }
        if (po === "laterales_zip" || po === "passepoil") {
          [-1, 1].forEach((s) => {
            const a: Pt = [s * p.demiCorps * 0.5, yB - 230], b: Pt = [s * p.demiCorps * 0.72, yB - 50];
            if (po === "laterales_zip") {
              traces.push({ role: "accessoire", d: ligne([a, b]), nom: "Zip de poche" });
              traces.push({ role: "accessoire", d: `M ${b[0] - 4} ${b[1] - 18} h 8 v 18 h -8 Z`, nom: "Tirette de poche" });
            } else {
              const t = norm(sub(b, a)), nn = mul(perp(t), 9);
              traces.push({ role: "piece", d: ligne([sub(a, nn), add(a, nn), add(b, nn), sub(b, nn)], true), nom: "Poche passepoilée" });
            }
          });
        }
        if (po === "rabat") {
          [-1, 1].forEach((s) => {
            const cx = s * p.demiCorps * 0.52, y = yB - 200, l = 150;
            traces.push({ role: "couture", d: ligne([[cx - l / 2, y + 50], [cx + l / 2, y + 50], [cx + l / 2, y + 190], [cx - l / 2, y + 190]], true), nom: "Poche" });
            traces.push({ role: "piece", d: ligne([[cx - l / 2 - 4, y], [cx + l / 2 + 4, y], [cx + l / 2 + 4, y + 55], [cx - l / 2 - 4, y + 55]], true), nom: "Rabat" });
            traces.push({ role: "surpiqure", d: ligne([[cx - l / 2, y + 6], [cx + l / 2, y + 6]]), nom: "Surpiqûre rabat" });
          });
        }
        if (po === "poitrine_rabat") {
          [-1, 1].forEach((s) => {
            const cx = s * p.demiCorps * 0.48, y = 175, l = 125;
            traces.push({ role: "couture", d: ligne([[cx - l / 2, y], [cx + l / 2, y], [cx + l / 2, y + 140], [cx, y + 155], [cx - l / 2, y + 140]], true), nom: "Poche poitrine" });
            traces.push({ role: "piece", d: ligne([[cx - l / 2 - 3, y - 10], [cx + l / 2 + 3, y - 10], [cx + l / 2 + 3, y + 30], [cx, y + 48], [cx - l / 2 - 3, y + 30]], true), nom: "Rabat poitrine" });
            traces.push({ role: "accessoire", d: rond([cx, y + 34], 6), nom: "Bouton" });
          });
        }
      }
    }

    // Plis du corps.
    traces.push({ role: "pli", d: lisse([[p.demiCorps * 0.5, p.UA[1] + 60], [p.demiCorps * 0.42, yB * 0.7], [p.demiCorps * 0.5, yB - 50]]) });
    traces.push({ role: "pli", d: lisse([[-p.demiCorps * 0.45, p.UA[1] + 90], [-p.demiCorps * 0.5, yB * 0.72], [-p.demiCorps * 0.42, yB - 60]]) });

    // ---------- Manches ----------
    [1, -1].forEach((s) => {
      const f = f2(s);
      const bout = p.bande || cfg.poignet === "elastique" ? quad(p.A, add(lerp(p.A, p.F, 0.5), p.u), p.F, 2) : [p.A, p.F];
      const manche: Pt[] = [p.SP, p.A, ...bout.slice(1, -1), p.F, p.I0];
      const emm = quad(p.I0, [p.SP[0] + 6, (p.SP[1] + p.I0[1]) / 2], p.SP, 10);
      const tour = [...manche, ...emm.slice(1, -1)].map(f);
      traces.push({ role: "piece", d: lisse(tour, true, 0.85), nom: s === 1 ? "Manche gauche" : "Manche droite" });
      temoins.push(...tour);
      const o1 = lerp(p.I0, p.F, 0.15), o2 = lerp(p.I0, p.F, 0.92), o3 = add(lerp(p.I0, p.F, 0.6), mul(p.n, -16));
      traces.push({ role: "ombre", d: lisse([o1, o3, o2].map(f), true, 0.5) });
      traces.push({ role: "couture", d: lisse(emm.map(f)), nom: "Emmanchure" });
      traces.push({ role: "surpiqure", d: lisse(decaler(emm, -5).map(f)), nom: "Surpiqûre emmanchure" });
      if (p.bande || cfg.poignet === "elastique" || det.froncesManche) {
        for (let i = 1; i <= 3; i++) {
          const b = lerp(p.A, p.F, i / 4);
          traces.push({ role: "pli", d: lisse([b, add(b, mul(p.u, -28)), add(add(b, mul(p.u, -50)), mul(p.n, 4))].map(f)) });
        }
      }
      if (cfg.poignet === "ourlet" || cfg.poignet === "elastique") {
        traces.push({ role: "surpiqure", d: ligne([add(p.A, mul(p.u, -20)), add(p.F, mul(p.u, -20))].map(f)), nom: cfg.poignet === "elastique" ? "Élastique de poignet" : "Ourlet de manche" });
      }
      const coude = lerp(p.SP, p.A, 0.55);
      traces.push({ role: "pli", d: lisse([add(coude, mul(p.n, 25)), add(add(coude, mul(p.n, 60)), mul(p.u, 25)), add(add(coude, mul(p.n, 90)), mul(p.u, 20))].map(f)) });
      if (det.matelassage) {
        const lg = Math.hypot(p.A[0] - p.SP[0], p.A[1] - p.SP[1]);
        for (let d = 110; d < lg - 30; d += 110) {
          const a = add(p.SP, mul(p.u, d)), b = add(a, mul(p.n, Math.min(lire(m, "largeur_manche", 230), 220)));
          traces.push({ role: "couture", d: ligne([a, b].map(f)), nom: "Matelassage manche" });
        }
      }
      if (det.bandes) {
        // Track jacket : deux bandes le long du dessus de la manche.
        [14, 30].forEach((o) => traces.push({ role: "couture", d: ligne([add(p.SP, mul(p.n, o)), add(p.A, mul(p.n, o))].map(f)), nom: "Bande de manche" }));
        [22].forEach((o) => traces.push({ role: "surpiqure", d: ligne([add(p.SP, mul(p.n, o)), add(p.A, mul(p.n, o))].map(f)), nom: "Bande de manche" }));
      }
      if (cfg.poches.includes("manche_zip") && s === -1 && vue === "face") {
        const a = add(add(p.SP, mul(p.u, 110)), mul(p.n, 35));
        const b = add(a, mul(p.u, 110));
        const c = add(b, mul(p.n, 70)), d = add(a, mul(p.n, 70));
        traces.push({ role: "piece", d: ligne([a, b, c, d].map(f), true), nom: "Poche de manche" });
        traces.push({ role: "accessoire", d: ligne([add(a, mul(p.n, 10)), add(b, mul(p.n, 10))].map(f)), nom: "Zip poche de manche" });
      }
      if (p.bande) {
        const poignet = [p.B, p.E, p.D, p.C].map(f);
        if (cfg.poignet === "cote") {
          traces.push({ role: "cote", d: ligne(poignet, true), nom: s === 1 ? "Poignet gauche" : "Poignet droit" });
          traces.push({ role: "pli", d: rayures(f(p.B), f(p.E), f(p.C), f(p.D), 3.5), nom: "Côtes poignet" });
        } else {
          traces.push({ role: "piece", d: ligne(poignet, true), nom: s === 1 ? "Poignet gauche" : "Poignet droit" });
          traces.push({ role: "surpiqure", d: ligne([lerp(p.B, p.C, 0.15), lerp(p.E, p.D, 0.15)].map(f)), nom: "Surpiqûre poignet" });
          traces.push({ role: "accessoire", d: rond(f(lerp(lerp(p.B, p.C, 0.5), lerp(p.E, p.D, 0.5), 0.8)), 5), nom: "Bouton de poignet" });
        }
        temoins.push(...poignet);
      }
    });

    // ---------- Col / capuche ----------
    if (cfg.col === "rond") {
      const hC = 20;
      const couture = encolure(dE + hC * 0.9, profEnc + hC, hC * 0.25);
      const fond = vue === "face" ? encolure(dE, 20 + hC * 0.6) : encolure(dE, -hC * 0.8);
      traces.push({ role: "interieur", d: ligne([...enc, ...[...fond].reverse()], true), nom: "Intérieur encolure" });
      traces.push({ role: "cote", d: ligne([...enc, ...[...couture].reverse()], true), nom: "Col" });
      traces.push({ role: "pli", d: enc.slice(1, -1).map((q, i) => ligne([q, couture[i + 1]])).join(" "), nom: "Côtes du col" });
      traces.push({ role: "surpiqure", d: ligne(decaler(couture, -3)), nom: "Surpiqûre col" });
    }
    if (cfg.col === "montant" || cfg.col === "bomber") {
      const h = lire(m, "hauteur_col", cfg.col === "bomber" ? 50 : 60);
      const avant = vue === "face";
      const bas = encolure(dE + 6, avant ? 40 : 18, 4);
      const haut = encolure(dE - 6, avant ? 18 : 8, -h).map(([x, y]) => [x, y] as Pt);
      if (avant) {
        // Deux moitiés séparées par la fermeture.
        [-1, 1].forEach((s) => {
          const moitie = (l: Pt[]) => l.filter(([x]) => (s === -1 ? x <= 0 : x >= 0));
          const b = moitie(bas), hh = moitie(haut);
          const poly = s === -1 ? [...hh, [-2, hh[hh.length - 1][1]] as Pt, [-2, b[b.length - 1][1]] as Pt, ...[...b].reverse()] : [[2, hh[0][1]] as Pt, ...hh, ...[...b].reverse(), [2, b[0][1]] as Pt];
          traces.push({ role: cfg.col === "bomber" ? "cote" : "piece", d: ligne(poly, true), nom: "Col montant" });
          if (cfg.col === "bomber") traces.push({ role: "pli", d: hh.map((q, i) => ligne([q, b[Math.min(i, b.length - 1)]])).join(" "), nom: "Côtes du col" });
        });
      } else {
        traces.push({ role: cfg.col === "bomber" ? "cote" : "piece", d: ligne([...haut, ...[...bas].reverse()], true), nom: "Col montant" });
        if (cfg.col === "bomber") traces.push({ role: "pli", d: haut.map((q, i) => ligne([q, bas[i]])).join(" "), nom: "Côtes du col" });
      }
      traces.push({ role: "surpiqure", d: ligne(haut.map(([x, y]) => [x, y + 6] as Pt)), nom: "Surpiqûre col" });
      temoins.push(...haut);
    }
    if (cfg.col === "chemise") {
      const avant = vue === "face";
      const pied = encolure(dE + 8, avant ? 22 : 10, -26);
      traces.push({ role: "piece", d: ligne([...pied, ...[...encolure(dE + 10, avant ? 40 : 18, 4)].reverse()], true), nom: "Pied de col" });
      if (avant) {
        [-1, 1].forEach((s) => {
          const g: Pt[] = [[s * (dE + 16), 4], [s * 92, 118], [s * 8, 70], [s * (dE - 30), -18]];
          traces.push({ role: "piece", d: lisse(g, true, 0.75), nom: "Col" });
          traces.push({ role: "surpiqure", d: ligne([[s * (dE + 6), 12], [s * 84, 108], [s * 14, 68]]), nom: "Surpiqûre col" });
        });
      } else {
        const g: Pt[] = [[-(dE + 16), 6], [-(dE + 24), 62], [dE + 24, 62], [dE + 16, 6], [0, -20]];
        traces.push({ role: "piece", d: lisse(g, true, 0.8), nom: "Col" });
        traces.push({ role: "surpiqure", d: ligne([[-(dE + 16), 54], [dE + 16, 54]]), nom: "Surpiqûre col" });
      }
      temoins.push([0, -30]);
    }
    if (aCapuche) {
      const cap = capuche(m, dE);
      temoins.push(...cap.tour);
      traces.push({ role: "piece", d: lisse(cap.tour, true), nom: "Capuche" });
      if (vue === "face") {
        const H = cap.H, W = cap.W;
        if (cfg.col === "cagoule") {
          // Capuche cagoule : capuche fermée avec une fenêtre ovale pour le visage.
          const yF = -H * 0.72, lF = W * 0.6, hF = H * 0.2;
          const fen = `M ${-lF / 2 + hF / 2} ${yF - hF / 2} h ${lF - hF} a ${hF / 2} ${hF / 2} 0 0 1 0 ${hF} h ${-(lF - hF)} a ${hF / 2} ${hF / 2} 0 0 1 0 ${-hF} Z`;
          traces.push({ role: "interieur", d: fen, nom: "Fenêtre visage" });
          traces.push({ role: "surpiqure", d: `M ${-lF / 2 + hF / 2} ${yF - hF / 2 - 7} h ${lF - hF} a ${hF / 2 + 7} ${hF / 2 + 7} 0 0 1 0 ${hF + 14} h ${-(lF - hF)} a ${hF / 2 + 7} ${hF / 2 + 7} 0 0 1 0 ${-hF - 14} Z`, nom: "Surpiqûre fenêtre" });
          traces.push({ role: "couture", d: ligne([[-28, -H * 0.995], [-28, yF - hF / 2 - 12]]) + " " + ligne([[28, -H * 0.995], [28, yF - hF / 2 - 12]]), nom: "Panneau capuche" });
          if (cfg.ouverture === "aucune") traces.push({ role: "couture", d: ligne([[0, yF + hF / 2 + 8], [0, 30]]), nom: "Couture milieu" });
        } else {
          const ouverture: Pt[] = [[0, 70], [-dE * 0.55, 20], [-W * 0.33, -H * 0.35], [-W * 0.22, -H * 0.8], [0, -H * 0.9], [W * 0.22, -H * 0.8], [W * 0.33, -H * 0.35], [dE * 0.55, 20]];
          traces.push({ role: "interieur", d: lisse(ouverture, true, 0.2), nom: "Intérieur capuche" });
          traces.push({ role: "surpiqure", d: lisse(ouverture.map(([x, y]) => [x * 1.09, y * 1.04 + (y > 0 ? 6 : 0)] as Pt), true, 0.2), nom: "Surpiqûre capuche" });
          if (cfg.ouverture === "aucune") traces.push({ role: "couture", d: ligne([[-dE * 0.55, 20], [12, 74]]), nom: "Croisement capuche" });
          const lgCordon = lire(m, "cordon", 320);
          [[-48, 32], [48, 32]].forEach(([x, y], i) => {
            const bt: Pt = [x + (i ? 8 : -8), y + lgCordon * 0.75];
            traces.push({ role: "accessoire", d: `M ${x} ${y} Q ${x + (i ? 4 : -4)} ${y + lgCordon * 0.4} ${bt[0]} ${bt[1]}`, nom: "Cordon" });
            traces.push({ role: "accessoire", d: fin.embout === "noeud" ? rond([bt[0], bt[1] + 6], 7) : `M ${bt[0] - 3.5} ${bt[1]} h 7 v 26 h -7 Z`, nom: "Embout" });
            traces.push({ role: "accessoire", d: rond([x, y], 5), nom: "Œillet" });
            temoins.push(bt);
          });
        }
      } else {
        const H = cap.H;
        traces.push({ role: "couture", d: ligne([[-28, -H * 0.995], [-28, 14]]) + " " + ligne([[28, -H * 0.995], [28, 14]]), nom: "Panneau capuche" });
        traces.push({ role: "surpiqure", d: ligne([[-22, -H * 0.98], [-22, 12]]) + " " + ligne([[22, -H * 0.98], [22, 12]]), nom: "Surpiqûre panneau" });
        traces.push({ role: "surpiqure", d: lisse(cubique([-dE - 18, 22], [-dE * 0.6, 34], [dE * 0.6, 34], [dE + 18, 22], 10)), nom: "Surpiqûre col" });
      }
    }
    // Le zip passe par-dessus la capuche cagoule : on le redessine au premier plan.
    if (ouvert && cfg.col === "cagoule" && cfg.ouverture === "zip") {
      const yHaut = -lire(m, "hauteur_capuche", 360) * 0.62;
      traces.push({ role: "accessoire", d: ligne([[-3.5, yHaut], [-3.5, 40]]) + " " + ligne([[3.5, yHaut], [3.5, 40]]), nom: "Zip (capuche)" });
    }
    return dessin(traces, temoins);
  }

  function zones(m: Mesures, vue: Vue): ZoneImpression[] {
    const p = points(m, "ecartes", cfg);
    if (vue === "profil") return [{ id: "manche", nom: "Manche", vue, cx: 0, y: p.pente + 90, l: 70, h: 240 }];
    const pc = lire(m, "demi_poitrine", 580);
    const yB = p.coteBas ? p.yCote : p.L;
    const zip = cfg.ouverture !== "aucune";
    if (vue === "face") {
      const z: ZoneImpression[] = [{ id: "coeur", nom: "Cœur", vue, cx: pc * 0.2, y: 130, l: 100, h: 100 }];
      if (!zip) z.push({ id: "centre", nom: "Centre devant", vue, cx: 0, y: 110, l: Math.min(280, pc - 170), h: Math.max(80, Math.min(280, yB - (cfg.poches.includes("kangourou") ? lire(m, "poche_hauteur", 200) : 0) - 150)) });
      if (zip) z.push({ id: "poitrine_droite", nom: "Poitrine droite", vue, cx: -pc * 0.2, y: 130, l: 100, h: 100 });
      if (cfg.poches.includes("kangourou")) z.push({ id: "poche", nom: "Poche", vue, cx: 0, y: yB - lire(m, "poche_hauteur", 200) + 30, l: Math.max(60, lire(m, "poche_haut", 260) - 70), h: Math.max(50, lire(m, "poche_hauteur", 200) - 70) });
      return z;
    }
    const z: ZoneImpression[] = [
      { id: "nuque", nom: "Nuque", vue, cx: 0, y: 60, l: 80, h: 50 },
      { id: "haut_dos", nom: "Haut du dos", vue, cx: 0, y: 80, l: Math.min(300, pc - 170), h: 120 },
      { id: "dos", nom: "Dos complet", vue, cx: 0, y: 80, l: Math.min(380, pc - 130), h: Math.min(450, yB - 140) },
    ];
    if (aCapuche) z.push({ id: "capuche", nom: "Capuche", vue, cx: 0, y: -lire(m, "hauteur_capuche", 360) * 0.75, l: 140, h: 140 });
    return z;
  }

  function controles(m: Mesures): Alerte[] {
    const a: Alerte[] = [];
    if (m.manche < m.longueur * 0.6) a.push({ cle: "manche", message: "Manche courte pour une pièce à manches longues : vérifie qu'elle est mesurée depuis la couture d'épaule." });
    if (m.poignet > m.largeur_manche) a.push({ cle: "poignet", message: "Le poignet est plus large que la manche." });
    if (m.largeur_bas > m.demi_poitrine * 1.15) a.push({ cle: "largeur_bas", message: "Le bas est beaucoup plus large que la poitrine." });
    if (m.epaules > m.demi_poitrine * 1.1) a.push({ cle: "epaules", message: "Les épaules sont plus larges que la poitrine." });
    if (m.poche_largeur && m.poche_largeur > m.demi_poitrine * 0.8) a.push({ cle: "poche_largeur", message: "Poche très large par rapport au corps." });
    return a;
  }

  function poignees(m: Mesures, _vue: Vue, pose: Pose): Poignee[] {
    const p = points(m, pose, cfg);
    return [
      { cle: "longueur", pos: [0, p.L], axe: [0, 1], facteur: 1 },
      { cle: "demi_poitrine", pos: [Math.max(p.demiCorps, p.UA[0]), p.UA[1] + 40], axe: [1, 0], facteur: 2 },
      { cle: "epaules", pos: p.SP, axe: [1, 0], facteur: 2 },
      { cle: "manche", pos: p.bande ? lerp(p.C, p.D, 0.5) : lerp(p.A, p.F, 0.5), axe: p.u, facteur: 1 },
    ];
  }

  return { dessiner, zones, controles, poignees };
}

/* ---------------- Mesures communes ---------------- */
function mesures(cfg: ConfigHaut): DefMesure[] {
  const D = cfg.defauts || {};
  const v = (cle: string, def: number) => D[cle] ?? def;
  const P = (m: Mesures) => points(m, "ecartes", cfg);
  const bandePoignet = cfg.poignet === "cote" || cfg.poignet === "bouton";
  const coteBas = cfg.bas === "cote" || cfg.bas === "ceinture";
  const aCapuche = cfg.col === "capuche" || cfg.col === "cagoule";
  const l: (DefMesure | false)[] = [
    { cle: "demi_poitrine", libelle: "Demi-tour de poitrine", aide: "À plat, d'un côté à l'autre, 2,5 cm sous l'emmanchure.", niveau: "obligatoire", defautM: v("demi_poitrine", 58), gradation: 2.5, min: 40, max: 95,
      cote: (m) => { const p = P(m); const x = Math.max(p.demiCorps, p.UA[0]); return { a: [-x, p.UA[1] + 25], b: [x, p.UA[1] + 25] }; } },
    { cle: "longueur", libelle: "Longueur totale", aide: "Du point haut de l'épaule jusqu'en bas" + (aCapuche ? " (sans la capuche)." : "."), niveau: "obligatoire", defautM: v("longueur", 70), gradation: 2, min: 40, max: 120,
      cote: (m) => { const p = P(m); return { a: [p.HPS[0] + 30, 0], b: [p.HPS[0] + 30, p.L] }; } },
    { cle: "manche", libelle: "Longueur de manche", aide: "De la couture d'épaule au bout de la manche.", niveau: "obligatoire", defautM: v("manche", 62), gradation: 1, min: 35, max: 95,
      cote: (m) => { const p = P(m); return { a: p.SP, b: add(p.SP, mul(p.u, lire(m, "manche", 620))), decalage: -22 }; } },
    { cle: "epaules", libelle: "Largeur d'épaules", aide: "D'une couture d'épaule à l'autre.", niveau: "recommande", defautM: v("epaules", 54), gradation: 2, min: 35, max: 85,
      cote: (m) => { const p = P(m); return { a: miroir(p.SP), b: p.SP, decalage: -50 }; } },
    { cle: "emmanchure", libelle: "Hauteur d'emmanchure", aide: "En droite, du point d'épaule au dessous de bras.", niveau: "recommande", defautM: v("emmanchure", 27), gradation: 1, min: 16, max: 45,
      cote: (m) => { const p = P(m); return { a: p.SP, b: p.UA }; } },
    { cle: "largeur_manche", libelle: "Largeur de manche (biceps)", aide: "À plat, en haut de la manche, perpendiculaire à la manche.", niveau: "recommande", defautM: v("largeur_manche", 23), gradation: 0.75, min: 12, max: 42 },
    { cle: "poignet", libelle: bandePoignet ? "Largeur du poignet" : "Ouverture de manche", aide: "À plat, au bout de la manche.", niveau: "recommande", defautM: v("poignet", bandePoignet ? 9.5 : 13), gradation: 0.5, min: 5, max: 25,
      cote: (m) => { const p = P(m); return bandePoignet ? { a: p.C, b: p.D, decalage: 14 } : { a: p.A, b: p.F, decalage: 14 }; } },
    { cle: "largeur_bas", libelle: coteBas ? "Largeur du bas (bande)" : "Largeur du bas", aide: "À plat, au repos, sans étirer.", niveau: "recommande", defautM: v("largeur_bas", coteBas ? 48 : 58), gradation: 2.5, min: 30, max: 95,
      cote: (m) => { const p = P(m); return { a: [-p.demiBas, p.L], b: [p.demiBas, p.L], decalage: 28 }; } },
    coteBas && { cle: "hauteur_bas", libelle: cfg.bas === "ceinture" ? "Hauteur de la ceinture" : "Hauteur du bord-côte du bas", aide: "Hauteur de la bande en bas.", niveau: "optionnel", defautM: v("hauteur_bas", cfg.bas === "ceinture" ? 4.5 : 7), gradation: 0, min: 2, max: 15 },
    bandePoignet && { cle: "hauteur_poignet", libelle: "Hauteur des poignets", aide: "Hauteur de la bande de poignet.", niveau: "optionnel", defautM: v("hauteur_poignet", cfg.poignet === "bouton" ? 5 : 7), gradation: 0, min: 2, max: 15 },
    { cle: "largeur_encolure", libelle: "Largeur d'encolure", aide: "D'une couture d'épaule à l'autre, au ras du col.", niveau: "optionnel", defautM: v("largeur_encolure", 20), gradation: 0.5, min: 14, max: 34 },
    cfg.col === "rond" && { cle: "prof_encolure_devant", libelle: "Profondeur d'encolure devant", aide: "Du haut de l'épaule au creux du col devant.", niveau: "optionnel", defautM: v("prof_encolure_devant", 8), gradation: 0.3, min: 3, max: 20 },
    (cfg.col === "montant" || cfg.col === "bomber") && { cle: "hauteur_col", libelle: "Hauteur du col", aide: "Hauteur du col montant, au milieu dos.", niveau: "optionnel", defautM: v("hauteur_col", cfg.col === "bomber" ? 5 : 6), gradation: 0, min: 2, max: 12 },
    aCapuche && { cle: "hauteur_capuche", libelle: "Hauteur de capuche", aide: "Capuche à plat : de la couture du col jusqu'au sommet.", niveau: "recommande", defautM: v("hauteur_capuche", 36), gradation: 0.5, min: 25, max: 50,
      cote: (m, vue) => ({ a: [0, 0], b: [0, -lire(m, "hauteur_capuche", 360)], decalage: vue === "face" ? -120 : -90 }) },
    aCapuche && { cle: "largeur_capuche", libelle: "Largeur de capuche", aide: "Capuche à plat, vue de côté, à l'endroit le plus large.", niveau: "recommande", defautM: v("largeur_capuche", 26), gradation: 0.5, min: 18, max: 40 },
    cfg.col === "capuche" && { cle: "cordon", libelle: "Longueur visible des cordons", aide: "De l'œillet jusqu'au bout de l'embout.", niveau: "optionnel", defautM: v("cordon", 32), gradation: 0, min: 0, max: 60 },
    cfg.poches.includes("kangourou") && { cle: "poche_largeur", libelle: "Largeur de poche (bas)", aide: "Poche kangourou, largeur en bas.", niveau: "optionnel", defautM: v("poche_largeur", 36), gradation: 1, min: 20, max: 60 },
    cfg.poches.includes("kangourou") && { cle: "poche_haut", libelle: "Largeur de poche (haut)", aide: "Poche kangourou, largeur du bord supérieur.", niveau: "optionnel", defautM: v("poche_haut", 26), gradation: 1, min: 10, max: 55 },
    cfg.poches.includes("kangourou") && { cle: "poche_hauteur", libelle: "Hauteur de poche", aide: "Du bas jusqu'au haut de la poche.", niveau: "optionnel", defautM: v("poche_hauteur", 20), gradation: 0.5, min: 10, max: 35 },
  ];
  return l.filter(Boolean) as DefMesure[];
}

export function creerHaut(cfg: ConfigHaut): Gabarit & { _points: (m: Mesures, pose: Pose) => Geo } {
  const c = construire(cfg);
  return {
    id: cfg.id,
    nom: cfg.nom,
    famille: cfg.famille,
    poseParDefaut: "ecartes",
    poses: ["ecartes", "le_long"],
    vues: ["face", "dos", "profil"],
    finitions: [
      "piqure",
      ...(cfg.poignet === "cote" || cfg.bas === "cote" || cfg.col === "rond" || cfg.col === "bomber" ? (["cotes"] as const) : []),
      ...(cfg.col === "capuche" ? (["cordon", "embout", "oeillet"] as const) : []),
      ...(cfg.ouverture === "zip" || cfg.poches.some((p) => p.includes("zip")) ? (["zip", "couleurZip"] as const) : []),
      ...(cfg.col === "rond" ? (["bandeProprete"] as const) : []),
    ],
    mesures: mesures(cfg),
    ...c,
    _points: (m, pose) => points(m, pose, cfg),
  };
}
