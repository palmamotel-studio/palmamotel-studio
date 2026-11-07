import type { Rendu } from "../moteur/rendu";
import { ROSE, NOIR, styleAccessoire, facteurPlis } from "../moteur/rendu";
import { FINITIONS_DEFAUT } from "../moteur/types";
import { opsElement, canvasOps } from "../moteur/elements";
import { pxParMm } from "../moteur/echelle";

type Images = Map<string, HTMLImageElement>;

/**
 * Rendu direct d'un calque sur canvas (export). Beaucoup plus rapide que de passer
 * par une image SVG à très grande taille, et identique visuellement.
 *
 * Occultation : quand une surface (pièce, bord-côte) arrive, on efface d'abord ce
 * qu'elle recouvre dans le calque (« destination-out ») avant de continuer.
 */
export function calqueCanvas(r: Rendu, id: string, dpi: number, images: Images = new Map()): HTMLCanvasElement {
  const vb = r.viewBox;
  const k = pxParMm(dpi);
  const c = document.createElement("canvas");
  c.width = Math.round(vb.l * k);
  c.height = Math.round(vb.h * k);
  const g = c.getContext("2d")!;
  g.setTransform(k, 0, 0, k, -vb.x * k, -vb.y * k);
  g.lineJoin = "round";
  g.lineCap = "round";
  dessinerCalque(g, r, id, images, k);
  return c;
}

const MODES: Record<string, GlobalCompositeOperation> = { multiply: "multiply", screen: "screen", overlay: "overlay", normal: "source-over" };

/** Composite de tous les calques visibles. */
export function compositeCanvas(r: Rendu, dpi: number, avecFond: boolean, images: Images = new Map()): HTMLCanvasElement {
  const ids = r.calques.filter((c) => !c.vide && (!c.masque || (c.id === "fond" && avecFond))).map((c) => c.id);
  const base = calqueCanvas(r, ids[0], dpi, images);
  const g = base.getContext("2d")!;
  g.setTransform(1, 0, 0, 1, 0, 0); // on assemble en pixels, sans l'échelle mm du calque
  for (const id of ids.slice(1)) {
    const cal = r.calques.find((c) => c.id === id)!;
    g.globalCompositeOperation = MODES[cal.fusion];
    g.drawImage(calqueCanvas(r, id, dpi, images), 0, 0);
  }
  g.globalCompositeOperation = "source-over";
  return base;
}

/** Bruit (chiné, délavé…) en tuile, généré une fois. */
const tuiles = new Map<string, HTMLCanvasElement>();
function tuileEffet(effet: string): HTMLCanvasElement {
  if (tuiles.has(effet)) return tuiles.get(effet)!;
  const n = 512, c = document.createElement("canvas");
  c.width = c.height = n;
  const g = c.getContext("2d")!;
  let graine = 7;
  const alea = () => ((graine = (graine * 16807) % 2147483647) / 2147483647);
  if (effet === "chiné") {
    for (let i = 0; i < 26000; i++) { g.fillStyle = `rgba(0,0,0,${alea() * 0.22})`; g.fillRect(alea() * n, alea() * n, 1 + alea() * 2.5, 0.8); }
  } else {
    const force = effet === "acid wash" ? 0.5 : effet === "délavé" ? 0.3 : 0.16;
    for (let i = 0; i < 70; i++) {
      const x = alea() * n, y = alea() * n, r = 20 + alea() * 90;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(0,0,0,${force * alea()})`); gr.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
  }
  tuiles.set(effet, c);
  return c;
}

function dessinerCalque(g: CanvasRenderingContext2D, r: Rendu, id: string, images: Images, k: number) {
  const { dessin, options: o, teintes: T } = r.source;
  const f = o.finitions ?? FINITIONS_DEFAUT;
  const kp = facteurPlis(o.grammage);
  const vb = r.viewBox;
  const surfaces = () => {
    const p = new Path2D();
    dessin.traces.filter((t) => t.role === "piece" || t.role === "cote").forEach((t) => p.addPath(new Path2D(t.d)));
    return p;
  };

  if (id === "fond") { g.fillStyle = o.fond; g.fillRect(vb.x, vb.y, vb.l, vb.h); return; }
  if (id.startsWith("zone-")) {
    const z = o.zones.find((x) => "zone-" + x.id === id);
    if (z) { g.fillStyle = "rgba(255,255,255,0.01)"; g.fillRect(z.cx - z.l / 2, z.y, z.l, z.h); }
    return;
  }
  if (id.startsWith("el-")) {
    const e = (o.elements ?? []).find((x) => "el-" + x.id === id);
    if (!e) return;
    g.translate(e.x, e.y); g.rotate((e.rotation * Math.PI) / 180);
    canvasOps(g, opsElement(e, o.taille ?? "M"), images);
    return;
  }
  if (id === "texture") {
    if (!o.effet || o.effet === "uni") return;
    g.save(); g.clip(surfaces());
    const motif = g.createPattern(tuileEffet(o.effet), "repeat")!;
    // La tuile est en pixels : on annule l'échelle mm pour garder un grain fin.
    motif.setTransform(new DOMMatrix().scale(o.effet === "chiné" ? 1 / k : 3 / k));
    g.fillStyle = motif; g.fillRect(vb.x, vb.y, vb.l, vb.h);
    g.restore();
    return;
  }
  if (id === "lumieres") {
    if (!T.colore) return;
    const b = dessin.boite;
    g.save(); g.clip(surfaces());
    const gr = g.createRadialGradient(b.x + b.l / 2, b.y + b.h * 0.32, 0, b.x + b.l / 2, b.y + b.h * 0.32, b.l * 0.35);
    gr.addColorStop(0, "rgba(255,255,255,0.22)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(vb.x, vb.y, vb.l, vb.h);
    g.restore();
    return;
  }
  if (id === "retouches") {
    o.retouches.forEach((rt) => {
      g.strokeStyle = rt.couleur; g.lineWidth = rt.epaisseur; g.beginPath();
      rt.pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
      g.stroke();
    });
    return;
  }
  if (id === "reperes") {
    g.strokeStyle = ROSE; g.fillStyle = ROSE; g.lineWidth = 0.6; g.font = "9px Helvetica, Arial, sans-serif";
    o.zones.filter((z) => o.zonesActives.includes(z.id)).forEach((z) => {
      g.setLineDash([3, 2]); g.strokeRect(z.cx - z.l / 2, z.y, z.l, z.h); g.setLineDash([]);
      g.fillText(`${z.nom} · ${(z.l / 10).toLocaleString("fr-FR")} × ${(z.h / 10).toLocaleString("fr-FR")} cm`, z.cx - z.l / 2 + 2, z.y - 2.5);
    });
    const x = vb.x + 12, y = vb.y + vb.h - 14;
    g.lineWidth = 0.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 100, y);
    for (let i = 0; i <= 100; i += 10) { g.moveTo(x + i, y); g.lineTo(x + i, y - (i % 50 === 0 ? 5 : 3)); }
    g.stroke(); g.font = "5.5px Helvetica, Arial, sans-serif"; g.fillText("10 cm — échelle réelle", x, y + 7);
    return;
  }

  for (const t of dessin.traces) {
    const p = new Path2D(t.d);
    const remplit = t.role === "piece" || t.role === "cote";
    // Une nouvelle surface cache ce qui est dessous dans ce calque.
    if (remplit && id !== "base") {
      g.globalCompositeOperation = "destination-out"; g.fillStyle = "#000"; g.fill(p); g.globalCompositeOperation = "source-over";
    }
    switch (id) {
      case "base":
        if (t.role === "piece") { g.fillStyle = T.tissu; g.fill(p); }
        else if (t.role === "cote") { g.fillStyle = T.cotes; g.fill(p); }
        else if (t.role === "interieur") { g.fillStyle = T.interieur; g.fill(p); }
        break;
      case "contours":
        if (t.role === "piece" || t.role === "cote" || t.role === "interieur") {
          g.strokeStyle = T.contour; g.lineWidth = t.role === "piece" ? 1.7 : t.role === "cote" ? 1.4 : 1.2; g.stroke(p);
        }
        break;
      case "coutures":
        if (t.role === "couture") { g.setLineDash([]); g.strokeStyle = T.fil; g.lineWidth = 0.6; g.stroke(p); }
        if (t.role === "surpiqure") {
          g.setLineDash([2.4, 1.6]);
          if (f.piqure === "double") { g.strokeStyle = T.fil; g.lineWidth = 2.9; g.stroke(p); g.strokeStyle = T.tissu; g.lineWidth = 1.8; g.stroke(p); }
          else { g.strokeStyle = T.fil; g.lineWidth = 0.55; g.stroke(p); }
          g.setLineDash([]);
        }
        break;
      case "ombres":
        if (t.role === "pli") {
          const cotes = t.nom?.startsWith("Côtes");
          g.strokeStyle = T.fonce ? "#000" : "#6b6b6b";
          g.globalAlpha = cotes ? 0.55 : Math.min(0.9, 0.55 * kp);
          g.lineWidth = cotes && f.cotes === "2x2" ? 1 : 0.45;
          g.stroke(p); g.globalAlpha = 1;
        }
        if (t.role === "ombre") { g.fillStyle = `rgba(0,0,0,${(T.colore ? 0.16 : 0.14) * kp})`; g.fill(p); }
        break;
      case "elements":
        if (t.role === "accessoire") {
          const ferme = /Z\s*$/i.test(t.d.trim()) || /a /.test(t.d);
          const st = styleAccessoire(t, f, T.accessoires, T.fil);
          if (ferme) { g.fillStyle = st.couleur; g.fill(p); g.strokeStyle = NOIR; g.lineWidth = 0.6; g.stroke(p); }
          else { g.strokeStyle = NOIR; g.lineWidth = st.large; g.stroke(p); g.strokeStyle = st.couleur; g.lineWidth = Math.max(0.6, st.large - 1.2); g.stroke(p); }
        }
        break;
    }
  }
}
