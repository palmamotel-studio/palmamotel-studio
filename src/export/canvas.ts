import type { Rendu } from "../moteur/rendu";
import { ROSE } from "../moteur/rendu";
import { pxParMm } from "../moteur/echelle";

/**
 * Rendu direct d'un calque sur canvas (export). Beaucoup plus rapide que de passer
 * par une image SVG à très grande taille, et identique visuellement.
 *
 * Occultation : quand une surface (pièce, bord-côte) arrive, on efface d'abord ce
 * qu'elle recouvre dans le calque (« destination-out ») avant de continuer.
 */
export function calqueCanvas(r: Rendu, id: string, dpi: number): HTMLCanvasElement {
  const vb = r.viewBox;
  const k = pxParMm(dpi);
  const c = document.createElement("canvas");
  c.width = Math.round(vb.l * k);
  c.height = Math.round(vb.h * k);
  const g = c.getContext("2d")!;
  g.setTransform(k, 0, 0, k, -vb.x * k, -vb.y * k);
  g.lineJoin = "round";
  g.lineCap = "round";
  dessinerCalque(g, r, id);
  return c;
}

/** Composite de tous les calques visibles. */
export function compositeCanvas(r: Rendu, dpi: number, avecFond: boolean): HTMLCanvasElement {
  const ids = r.calques.filter((c) => !c.vide && (!c.masque || (c.id === "fond" && avecFond))).map((c) => c.id);
  const base = calqueCanvas(r, ids[0], dpi);
  const g = base.getContext("2d")!;
  for (const id of ids.slice(1)) {
    const cal = r.calques.find((c) => c.id === id)!;
    g.globalCompositeOperation = cal.fusion === "multiply" ? "multiply" : "source-over";
    g.drawImage(calqueCanvas(r, id, dpi), 0, 0);
  }
  g.globalCompositeOperation = "source-over";
  return base;
}

function dessinerCalque(g: CanvasRenderingContext2D, r: Rendu, id: string) {
  const { dessin, options: o, teintes: T } = r.source;
  const vb = r.viewBox;
  if (id === "fond") { g.fillStyle = o.fond; g.fillRect(vb.x, vb.y, vb.l, vb.h); return; }
  if (id.startsWith("zone-")) {
    const z = o.zones.find((x) => "zone-" + x.id === id);
    if (z) { g.fillStyle = "rgba(255,255,255,0.01)"; g.fillRect(z.cx - z.l / 2, z.y, z.l, z.h); }
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
        if (t.role === "surpiqure") { g.setLineDash([2.4, 1.6]); g.strokeStyle = T.fil; g.lineWidth = 0.55; g.stroke(p); g.setLineDash([]); }
        break;
      case "ombres":
        if (t.role === "pli") { g.strokeStyle = T.fonce ? "rgba(0,0,0,0.55)" : "rgba(107,107,107,0.55)"; g.lineWidth = 0.45; g.stroke(p); }
        if (t.role === "ombre") { g.fillStyle = `rgba(0,0,0,${T.colore ? 0.16 : 0.14})`; g.fill(p); }
        break;
      case "elements":
        if (t.role === "accessoire") {
          const ferme = /Z\s*$/i.test(t.d.trim()) || /a /.test(t.d);
          if (ferme) { g.fillStyle = T.accessoires; g.fill(p); g.strokeStyle = "#1b1b1b"; g.lineWidth = 0.6; g.stroke(p); }
          else { g.strokeStyle = "#1b1b1b"; g.lineWidth = 3.6; g.stroke(p); g.strokeStyle = T.accessoires; g.lineWidth = 2.4; g.stroke(p); }
        }
        break;
    }
  }
}
