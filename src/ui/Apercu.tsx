import { useMemo, useRef, useState } from "react";
import { useEditeur } from "../etat/store";
import { rendreProjet, mesuresDe } from "../etat/calcul";
import { svgCote } from "../moteur/rendu";
import { TAILLES, NOMS_VUES, VUES, type Pt } from "../moteur/types";
import { details } from "../moteur/details";
import { useVisuels } from "../etat/visuels";

export type OutilRetouche = "poignees" | "dessin" | "elements";

interface Props {
  outil: OutilRetouche | null;
  epaisseur: number;
  couleurTrait: string;
}

/** Aperçu du vêtement : dessin, cotes de mesure, poignées de retouche et dessin libre. */
export function Apercu({ outil, epaisseur, couleurTrait }: Props) {
  const { projet, vue, taille, mesureActive, elementActif, set, modifier } = useEditeur();
  const versionVisuels = useVisuels((s) => s.version);
  const svgRef = useRef<SVGSVGElement>(null);
  const [trait, setTrait] = useState<Pt[] | null>(null);
  const [detail, setDetail] = useState<string>("");
  const glisse = useRef<{ cle: string; depart: Pt; valeur: number; axe: Pt; facteur: number } | null>(null);
  const glisseEl = useRef<{ id: string; dx: number; dy: number } | null>(null);

  const r = useMemo(() => (projet ? rendreProjet(projet, vue, taille, "ap") : null), [projet, vue, taille, versionVisuels]);
  const calc = useMemo(() => (projet ? mesuresDe(projet, taille) : null), [projet, taille]);
  if (!projet || !r || !calc) return null;
  const { g, cm, mm } = calc;
  const pose = g.poses.includes(projet.pose) ? projet.pose : g.poseParDefaut;
  const vuesDispo = g.vues ?? VUES;
  const zooms = details(r);
  const zoom = zooms.find((z) => z.id === detail);
  const vb = zoom ?? r.viewBox;
  const avecReperes = projet.zonesActives.length > 0;
  const interne = r.calques.filter((c) => !c.masque || (c.id === "reperes" && avecReperes)).map((c) => `<g${c.fusion !== "normal" ? ` style="mix-blend-mode:${c.fusion}"` : ""}>${c.contenu}</g>`).join("");
  const elementsVue = (projet.elements || []).filter((e) => e.vue === vue);
  const elSel = elementsVue.find((e) => e.id === elementActif);

  const def = mesureActive ? g.mesures.find((d) => d.cle === mesureActive) : null;
  const cote = def?.cote?.(mm, vue);
  const coteSvg = cote ? svgCote(cote, `${String(cm[def!.cle]).replace(".", ",")} cm`) : "";

  const versMm = (e: React.PointerEvent): Pt => {
    const s = svgRef.current!;
    const pt = s.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const q = pt.matrixTransform(s.getScreenCTM()!.inverse());
    return [q.x, q.y];
  };

  const poignees = outil === "poignees" ? g.poignees?.(mm, vue, pose) || [] : [];

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
  function bouge(e: React.PointerEvent) {
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
    if (trait) setTrait([...trait, versMm(e)]);
  }
  function fin() {
    if (glisseEl.current) { glisseEl.current = null; return; }
    if (glisse.current) { glisse.current = null; return; }
    if (trait && trait.length > 1) {
      const t = trait;
      modifier((pr) => { pr.retouches[vue] = [...(pr.retouches[vue] || []), { pts: t, epaisseur, couleur: couleurTrait }]; });
    }
    setTrait(null);
  }

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
      </div>
      <div className="scene">
        <svg
          ref={svgRef}
          className="vetement"
          viewBox={`${vb.x} ${vb.y} ${vb.l} ${vb.h}`}
          onPointerDown={(e) => { if (outil === "dessin") { (e.target as Element).setPointerCapture?.(e.pointerId); setTrait([versMm(e)]); } }}
          onPointerMove={bouge}
          onPointerUp={fin}
          onPointerCancel={fin}
          style={{ cursor: outil === "dessin" ? "crosshair" : "default" }}
        >
          <defs dangerouslySetInnerHTML={{ __html: r.defs }} />
          <g dangerouslySetInnerHTML={{ __html: interne }} />
          <g dangerouslySetInnerHTML={{ __html: coteSvg }} />
          {trait && <polyline points={trait.map((p) => p.join(",")).join(" ")} fill="none" stroke={couleurTrait} strokeWidth={epaisseur} strokeLinecap="round" strokeLinejoin="round" />}
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
              <circle cx={h.pos[0]} cy={h.pos[1]} r={22} fill="transparent" />
              <circle cx={h.pos[0]} cy={h.pos[1]} r={9} fill="#d9466e" stroke="#fff" strokeWidth={3} />
            </g>
          ))}
        </svg>
      </div>
    </section>
  );
}
