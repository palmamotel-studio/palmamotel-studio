import type { Rendu } from "./rendu";

/**
 * VUES DE DÉTAIL : zooms sur une zone du dessin (col, poignet, poche, étiquette).
 * Calculées à partir des tracés nommés du gabarit ; aucune géométrie supplémentaire.
 */
export interface Detail { id: string; nom: string; x: number; y: number; l: number; h: number }

/** Boîte approximative d'un chemin SVG (commandes absolues M, L, C, Q). */
export function boiteChemin(d: string) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const re = /([MLCQ])([^MLCQZmlcqahvzAHV]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(d))) {
    const n = m[2].trim().split(/[\s,]+/).map(Number).filter((v) => Number.isFinite(v));
    for (let i = 0; i + 1 < n.length; i += 2) {
      x0 = Math.min(x0, n[i]); x1 = Math.max(x1, n[i]); y0 = Math.min(y0, n[i + 1]); y1 = Math.max(y1, n[i + 1]);
    }
  }
  return Number.isFinite(x0) ? { x: x0, y: y0, l: x1 - x0, h: y1 - y0 } : null;
}

const GROUPES: { id: string; nom: string; noms: RegExp }[] = [
  { id: "col", nom: "Col / ceinture", noms: /^(Col|Col polo|Col montant|Pied de col|Bande d'encolure|Ceinture|Ceinture élastiquée|Capuche)$/ },
  { id: "poignet", nom: "Poignet / bas de jambe", noms: /^(Poignet gauche|Poignet|Bord-côte de manche|Bord-côte de jambe)$/ },
  { id: "poche", nom: "Poche", noms: /^(Poche kangourou|Poche cargo|Poche arrière|Rabat|Rabat poitrine|Poche passepoilée|Poche de manche)$/ },
];

export function details(r: Rendu): Detail[] {
  const out: Detail[] = [];
  const cadre = (id: string, nom: string, b: { x: number; y: number; l: number; h: number }) => {
    const c = Math.max(140, Math.max(b.l, b.h) * 1.35);
    out.push({ id, nom, x: b.x + b.l / 2 - c / 2, y: b.y + b.h / 2 - c / 2, l: c, h: c });
  };
  for (const g of GROUPES) {
    const t = r.source.dessin.traces.find((x) => g.noms.test(x.nom || ""));
    const b = t && boiteChemin(t.d);
    if (b) cadre(g.id, g.nom, b);
  }
  const el = (r.source.options.elements ?? [])[0];
  if (el) cadre("etiquette", "Étiquette / élément", { x: el.x - el.l / 2, y: el.y - el.h / 2, l: el.l, h: el.h });
  return out;
}
