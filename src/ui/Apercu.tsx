import { useMemo, useRef, useState } from "react";
import { useEditeur } from "../etat/store";
import { rendreProjet, mesuresDe } from "../etat/calcul";
import { svgCote } from "../moteur/rendu";
import { TAILLES, NOMS_VUES, type Pt, type Vue } from "../moteur/types";

export type OutilRetouche = "poignees" | "dessin";

interface Props {
  outil: OutilRetouche | null;
  epaisseur: number;
  couleurTrait: string;
}

/** Aperçu du vêtement : dessin, cotes de mesure, poignées de retouche et dessin libre. */
export function Apercu({ outil, epaisseur, couleurTrait }: Props) {
  const { projet, vue, taille, mesureActive, set, modifier } = useEditeur();
  const svgRef = useRef<SVGSVGElement>(null);
  const [trait, setTrait] = useState<Pt[] | null>(null);
  const glisse = useRef<{ cle: string; depart: Pt; valeur: number; axe: Pt; facteur: number } | null>(null);

  const r = useMemo(() => (projet ? rendreProjet(projet, vue, taille, "ap") : null), [projet, vue, taille]);
  const calc = useMemo(() => (projet ? mesuresDe(projet, taille) : null), [projet, taille]);
  if (!projet || !r || !calc) return null;
  const { g, cm, mm } = calc;
  const pose = g.poses.includes(projet.pose) ? projet.pose : g.poseParDefaut;
  const vb = r.viewBox;
  const avecReperes = projet.zonesActives.length > 0;
  const interne = r.calques.filter((c) => !c.masque || (c.id === "reperes" && avecReperes)).map((c) => `<g${c.fusion === "multiply" ? ' style="mix-blend-mode:multiply"' : ""}>${c.contenu}</g>`).join("");

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
  function bouge(e: React.PointerEvent) {
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
          {(["face", "dos"] as Vue[]).map((v) => (
            <button key={v} aria-pressed={vue === v} onClick={() => set({ vue: v })}>{NOMS_VUES[v]}</button>
          ))}
        </div>
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
