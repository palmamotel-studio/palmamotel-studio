import { useEffect, useMemo, useRef, useState } from "react";
import { useEditeur } from "../etat/store";
import { rendreProjet, mesuresDe, vuesDe } from "../etat/calcul";
import { svgCote, cheminRetouche, type FormeRetouche } from "../moteur/rendu";
import { TAILLES, NOMS_VUES, type Pt } from "../moteur/types";
import { details } from "../moteur/details";
import { useVisuels } from "../etat/visuels";

export type OutilRetouche =
  | "poignees" | "elements" | "main"
  | "dessin" | "ligne" | "pointilles" | "rect" | "ellipse"
  | "gomme" | "remplir" | "allonger";

const FORMES: Partial<Record<OutilRetouche, FormeRetouche>> = { ligne: "ligne", pointilles: "pointilles", rect: "rect", ellipse: "ellipse" };

interface Props {
  outil: OutilRetouche | null;
  epaisseur: number;
  couleurTrait: string;
  /** Remplissage des rectangles et ellipses (null = vide). */
  plein?: string | null;
  tolerance?: number;
}

/** Aperçu du vêtement : dessin, cotes, poignées, outils de retouche, zoom et déplacement. */
export function Apercu({ outil, epaisseur, couleurTrait, plein = null, tolerance = 60 }: Props) {
  const { projet, vue, taille, mesureActive, elementActif, coupe, set, modifier } = useEditeur();
  const versionVisuels = useVisuels((s) => s.version);
  const svgRef = useRef<SVGSVGElement>(null);
  const [trait, setTrait] = useState<Pt[] | null>(null);
  const [detail, setDetail] = useState<string>("");
  const [zoom, setZoom] = useState(1);
  const [centre, setCentre] = useState<Pt | null>(null);
  const glisse = useRef<{ cle: string; depart: Pt; valeur: number; axe: Pt; facteur: number } | null>(null);
  const glisseEl = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const pan = useRef<{ x: number; y: number } | null>(null);
  const doigts = useRef(new Map<number, { x: number; y: number }>());
  const pince = useRef<{ d: number; zoom: number } | null>(null);

  const r = useMemo(() => (projet ? rendreProjet(projet, vue, taille, "ap") : null), [projet, vue, taille, versionVisuels]);
  const calc = useMemo(() => (projet ? mesuresDe(projet, taille) : null), [projet, taille]);
  useEffect(() => { setZoom(1); setCentre(null); }, [vue, detail]);
  if (!projet || !r || !calc) return null;
  const { g, cm, mm } = calc;
  const pose = g.poses.includes(projet.pose) ? projet.pose : g.poseParDefaut;
  const vuesDispo = vuesDe(projet);
  const zooms = details(r);
  const base = zooms.find((z) => z.id === detail) ?? r.viewBox;
  const c0: Pt = centre ?? [base.x + base.l / 2, base.y + base.h / 2];
  const vb = { x: c0[0] - base.l / zoom / 2, y: c0[1] - base.h / zoom / 2, l: base.l / zoom, h: base.h / zoom };
  const avecReperes = projet.zonesActives.length > 0;
  const interne = r.calques.filter((c) => !c.masque || (c.id === "reperes" && avecReperes)).map((c) => `<g${c.fusion !== "normal" ? ` style="mix-blend-mode:${c.fusion}"` : ""}>${c.contenu}</g>`).join("");
  const elementsVue = (projet.elements || []).filter((e) => e.vue === vue);
  const elSel = elementsVue.find((e) => e.id === elementActif);
  const img = r.source.options.image;

  const def = mesureActive ? g.mesures.find((d) => d.cle === mesureActive) : null;
  const cote = def?.cote?.(mm, vue);
  const coteSvg = cote ? svgCote(cote, `${String(cm[def!.cle]).replace(".", ",")} cm`) : "";

  const versMm = (e: { clientX: number; clientY: number }): Pt => {
    const s = svgRef.current!;
    const pt = s.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const q = pt.matrixTransform(s.getScreenCTM()!.inverse());
    return [q.x, q.y];
  };
  const zoomer = (k: number, autour?: Pt) => {
    const nz = Math.min(16, Math.max(1, zoom * k));
    if (nz === 1) { setZoom(1); setCentre(null); return; }
    const a = autour ?? c0;
    setCentre([a[0] + (c0[0] - a[0]) * (zoom / nz), a[1] + (c0[1] - a[1]) * (zoom / nz)]);
    setZoom(nz);
  };

  const poignees = outil === "poignees" ? g.poignees?.(mm, vue, pose) || [] : [];
  const traceur = outil === "dessin" || outil === "gomme" || !!FORMES[outil ?? "poignees"];

  function debutPoignee(e: React.PointerEvent, cle: string, axe: Pt, facteur: number) {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    glisse.current = { cle, depart: versMm(e), valeur: cm[cle], axe, facteur };
    set({ mesureActive: cle });
  }
  function debutElement(e: React.PointerEvent, id: string) {
    if (outil !== "elements") return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const el = elementsVue.find((x) => x.id === id)!;
    const p = versMm(e);
    glisseEl.current = { id, dx: p[0] - el.x, dy: p[1] - el.y };
    set({ elementActif: id });
  }
  function bas(e: React.PointerEvent) {
    doigts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    (e.target as Element).setPointerCapture?.(e.pointerId);
    if (doigts.current.size === 2) {
      // Deux doigts : on zoome / déplace, et on annule le trait en cours.
      const [a, b] = [...doigts.current.values()];
      pince.current = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom };
      setTrait(null);
      return;
    }
    const p = versMm(e);
    if (outil === "main" || e.button === 1) { pan.current = { x: e.clientX, y: e.clientY }; return; }
    if (traceur) { setTrait([p]); return; }
    if (outil === "remplir" && projet!.modele) {
      modifier((pr) => { const l = pr.retouchesImage ?? (pr.retouchesImage = {}); l[vue] = [...(l[vue] ?? []), { t: "remplir", x: p[0], y: p[1], couleur: couleurTrait, tolerance }]; });
      return;
    }
    if (outil === "allonger" && projet!.modele) set({ coupe: { axe: coupe?.axe ?? "v", pos: Math.round((coupe?.axe === "h" ? p[0] : p[1]) * 10) / 10 } });
  }
  function bouge(e: React.PointerEvent) {
    if (doigts.current.has(e.pointerId)) doigts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pince.current && doigts.current.size === 2) {
      const [a, b] = [...doigts.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const nz = Math.min(16, Math.max(1, pince.current.zoom * (d / pince.current.d)));
      setZoom(nz); if (nz === 1) setCentre(null); else if (!centre) setCentre(c0);
      return;
    }
    if (pan.current) {
      const s = svgRef.current!.getBoundingClientRect();
      const k = vb.l / s.width;
      const dx = (e.clientX - pan.current.x) * k, dy = (e.clientY - pan.current.y) * k;
      pan.current = { x: e.clientX, y: e.clientY };
      setCentre([c0[0] - dx, c0[1] - dy]);
      return;
    }
    const ge = glisseEl.current;
    if (ge) {
      const p = versMm(e);
      let x = p[0] - ge.dx;
      if (Math.abs(x) < 4) x = 0; // aimant sur l'axe central
      modifier((pr) => { const el = pr.elements.find((z) => z.id === ge.id); if (el) { el.x = Math.round(x); el.y = Math.round(p[1] - ge.dy); } }, "el-" + ge.id);
      return;
    }
    const gl = glisse.current;
    if (gl) {
      const p = versMm(e);
      const d = (p[0] - gl.depart[0]) * gl.axe[0] + (p[1] - gl.depart[1]) * gl.axe[1];
      const def = g.mesures.find((x) => x.cle === gl.cle)!;
      const v = Math.round(Math.min(def.max, Math.max(def.min, gl.valeur + (d * gl.facteur) / 10)) * 2) / 2;
      modifier((pr) => { pr.tableau[taille] = { ...(pr.tableau[taille] || {}), [gl.cle]: v }; }, "poignee-" + gl.cle);
      return;
    }
    if (trait) setTrait(FORMES[outil!] ? [trait[0], versMm(e)] : [...trait, versMm(e)]);
  }
  function fin(e: React.PointerEvent) {
    doigts.current.delete(e.pointerId);
    if (doigts.current.size < 2) pince.current = null;
    pan.current = null;
    if (glisseEl.current) { glisseEl.current = null; return; }
    if (glisse.current) { glisse.current = null; return; }
    if (trait) {
      const t = trait;
      if (outil === "gomme" && projet!.modele) {
        modifier((pr) => { const l = pr.retouchesImage ?? (pr.retouchesImage = {}); l[vue] = [...(l[vue] ?? []), { t: "gomme", pts: t, epaisseur }]; });
      } else if (outil !== "gomme" && (t.length > 1 || FORMES[outil!])) {
        const forme = FORMES[outil!];
        if (!forme || Math.hypot(t[t.length - 1][0] - t[0][0], t[t.length - 1][1] - t[0][1]) > 1)
          modifier((pr) => { pr.retouches[vue] = [...(pr.retouches[vue] || []), { pts: t, epaisseur, couleur: couleurTrait, ...(forme ? { forme, plein: forme === "rect" || forme === "ellipse" ? plein : null } : {}) }]; });
      }
    }
    setTrait(null);
  }

  const apercuTrait = trait && (() => {
    const forme = FORMES[outil!];
    const d = cheminRetouche({ pts: trait, epaisseur, couleur: couleurTrait, forme });
    if (outil === "gomme") return <path d={d} fill="none" stroke="#ffffff" strokeOpacity={0.85} strokeWidth={epaisseur} strokeLinecap="round" strokeLinejoin="round" />;
    return <path d={d} fill={forme === "rect" || forme === "ellipse" ? plein ?? "none" : "none"} stroke={couleurTrait} strokeWidth={epaisseur} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={forme === "pointilles" ? `${epaisseur * 4} ${epaisseur * 2.6}` : undefined} />;
  })();

  const curseur = outil === "main" ? "grab" : traceur || outil === "remplir" || outil === "allonger" ? "crosshair" : "default";
  return (
    <section className="apercu" aria-label="Aperçu du mock-up">
      <div className="outils">
        <div className="seg" role="group" aria-label="Vue">
          {vuesDispo.map((v) => (
            <button key={v} aria-pressed={vue === v} onClick={() => set({ vue: v })}>{NOMS_VUES[v]}</button>
          ))}
        </div>
        {zooms.length > 0 && (
          <select aria-label="Détail" value={detail} onChange={(e) => setDetail(e.target.value)} style={{ width: "auto", minHeight: 40 }}>
            <option value="">Vue entière</option>
            {zooms.map((z) => <option key={z.id} value={z.id}>Détail : {z.nom}</option>)}
          </select>
        )}
        <div className="seg tailles" role="group" aria-label="Taille affichée">
          {TAILLES.map((t) => (
            <button key={t} aria-pressed={taille === t} onClick={() => set({ taille: t })}>{t}</button>
          ))}
        </div>
        {g.poses.length > 1 && (
          <div className="seg" role="group" aria-label="Pose des bras">
            <button aria-pressed={pose === "ecartes"} onClick={() => modifier((p) => { p.pose = "ecartes"; })}>Bras écartés</button>
            <button aria-pressed={pose === "le_long"} onClick={() => modifier((p) => { p.pose = "le_long"; })}>Bras le long</button>
          </div>
        )}
        <div className="seg" role="group" aria-label="Zoom">
          <button onClick={() => zoomer(1 / 1.5)} aria-label="Dézoomer">−</button>
          <button onClick={() => { setZoom(1); setCentre(null); }} aria-label="Vue entière" className="mono">{Math.round(zoom * 100)} %</button>
          <button onClick={() => zoomer(1.5)} aria-label="Zoomer">+</button>
        </div>
      </div>
      <div className="scene">
        <svg
          ref={svgRef}
          className="vetement"
          viewBox={`${vb.x} ${vb.y} ${vb.l} ${vb.h}`}
          onPointerDown={bas}
          onPointerMove={bouge}
          onPointerUp={fin}
          onPointerCancel={fin}
          onWheel={(e) => { zoomer(e.deltaY < 0 ? 1.15 : 1 / 1.15, versMm(e)); }}
          style={{ cursor: curseur }}
        >
          <defs dangerouslySetInnerHTML={{ __html: r.defs }} />
          <g dangerouslySetInnerHTML={{ __html: interne }} />
          <g dangerouslySetInnerHTML={{ __html: coteSvg }} />
          {apercuTrait}
          {coupe && img && outil === "allonger" && (
            coupe.axe === "v"
              ? <line x1={img.x - 20} x2={img.x + img.l + 20} y1={coupe.pos} y2={coupe.pos} stroke="#d9466e" strokeWidth={1.6 / zoom} strokeDasharray={`${8 / zoom} ${5 / zoom}`} />
              : <line y1={-20} y2={img.h + 20} x1={coupe.pos} x2={coupe.pos} stroke="#d9466e" strokeWidth={1.6 / zoom} strokeDasharray={`${8 / zoom} ${5 / zoom}`} />
          )}
          {outil === "elements" && elementsVue.map((el) => (
            <rect key={el.id} x={el.x - el.l / 2 - 4} y={el.y - el.h / 2 - 4} width={el.l + 8} height={el.h + 8} fill="transparent"
              transform={`rotate(${el.rotation} ${el.x} ${el.y})`} style={{ cursor: "move" }} onPointerDown={(e) => debutElement(e, el.id)} />
          ))}
          {outil === "elements" && elSel && (
            <g pointerEvents="none" transform={`rotate(${elSel.rotation} ${elSel.x} ${elSel.y})`}>
              <rect x={elSel.x - elSel.l / 2 - 3} y={elSel.y - elSel.h / 2 - 3} width={elSel.l + 6} height={elSel.h + 6} fill="none" stroke="#d9466e" strokeWidth={1.4} strokeDasharray="4 3" />
              <text x={elSel.x} y={elSel.y - elSel.h / 2 - 8} textAnchor="middle" fontSize={11} fontWeight={700} fill="#d9466e" fontFamily="Helvetica, Arial, sans-serif">{(elSel.l / 10).toLocaleString("fr-FR")} × {(elSel.h / 10).toLocaleString("fr-FR")} cm</text>
            </g>
          )}
          {poignees.map((h) => (
            <g key={h.cle} onPointerDown={(e) => debutPoignee(e, h.cle, h.axe, h.facteur)} style={{ cursor: "grab" }}>
              <circle cx={h.pos[0]} cy={h.pos[1]} r={22 / zoom} fill="transparent" />
              <circle cx={h.pos[0]} cy={h.pos[1]} r={9 / zoom} fill="#d9466e" stroke="#fff" strokeWidth={3 / zoom} />
            </g>
          ))}
        </svg>
      </div>
    </section>
  );
}
