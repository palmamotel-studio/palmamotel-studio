import { useState } from "react";
import { useEditeur } from "../etat/store";
import { NOMS_VUES } from "../moteur/types";
import type { OutilRetouche } from "./Apercu";

const fmt = (n: number) => (Math.round(n * 10) / 10).toLocaleString("fr-FR");

export interface ReglagesRetouche {
  outil: OutilRetouche; setOutil: (o: OutilRetouche) => void;
  epaisseur: number; setEpaisseur: (n: number) => void;
  couleurTrait: string; setCouleurTrait: (c: string) => void;
  plein: string | null; setPlein: (c: string | null) => void;
  tolerance: number; setTolerance: (n: number) => void;
}

const AIDE: Partial<Record<OutilRetouche, string>> = {
  poignees: "Fais glisser les points roses : longueur, poitrine, épaules, manche, bas. Les mesures se mettent à jour.",
  main: "Fais glisser pour te déplacer dans le dessin. Zoom : boutons + / −, molette, ou pincement à deux doigts.",
  dessin: "Dessine au doigt ou à l'Apple Pencil.",
  ligne: "Trace une ligne droite : appuie au départ, relâche à l'arrivée.",
  pointilles: "Trace une surpiqûre (ligne en pointillés) d'un point à un autre.",
  rect: "Trace un rectangle (poche, patte, empiècement…).",
  ellipse: "Trace un rond ou une ellipse (bouton, œillet, patch…).",
  gomme: "Efface une partie du dessin du modèle (une poche, une couture, un cordon…).",
  remplir: "Touche une zone fermée du dessin pour la colorer (poche, manche, capuche, empiècement). Les plis restent visibles.",
  allonger: "Touche le dessin à l'endroit où couper, puis choisis de combien allonger (+) ou raccourcir (−).",
};

/** Étape 6 : retouches du dessin, jusque dans les détails. */
export function EtapeRetouches(r: ReglagesRetouche) {
  const { projet, modifier, vue, coupe, set } = useEditeur();
  const [delta, setDelta] = useState("2");
  if (!projet) return null;
  const modele = !!projet.modele;
  const nb = projet.retouches[vue]?.length || 0;
  const ops = projet.retouchesImage?.[vue] ?? [];
  const outils: [OutilRetouche, string][] = [
    ...(!modele ? ([["poignees", "Ajuster la forme"]] as [OutilRetouche, string][]) : []),
    ["main", "Se déplacer"], ["dessin", "Crayon"], ["ligne", "Ligne"], ["pointilles", "Surpiqûre"], ["rect", "Rectangle"], ["ellipse", "Ellipse"],
    ...(modele ? ([["gomme", "Gomme"], ["remplir", "Pot de peinture"], ["allonger", "Allonger / raccourcir"]] as [OutilRetouche, string][]) : []),
  ];
  const traceur = ["dessin", "ligne", "pointilles", "rect", "ellipse", "gomme"].includes(r.outil);

  function appliquerCoupe() {
    const d = parseFloat(delta.replace(",", ".")) * 10;
    if (!coupe || !Number.isFinite(d) || !d) return;
    modifier((p) => { const l = p.retouchesImage ?? (p.retouchesImage = {}); l[vue] = [...(l[vue] ?? []), { t: "allonger", axe: coupe.axe, pos: coupe.pos, delta: d }]; });
    set({ coupe: null });
  }

  return (
    <div className="stack">
      <div><span className="eyebrow">Étape {modele ? 5 : 6}</span><h2>Retouches</h2></div>
      <div className="pieces" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(118px, 1fr))" }}>
        {outils.map(([o, nom]) => (
          <button key={o} className="piece" style={{ minHeight: 48, outline: r.outil === o ? "3px solid var(--accent)" : undefined }} aria-pressed={r.outil === o} onClick={() => { r.setOutil(o); if (o !== "allonger") set({ coupe: null }); }}>{nom}</button>
        ))}
      </div>
      <p className="note">{AIDE[r.outil]}</p>

      {(traceur || r.outil === "remplir") && (
        <div className="grid2">
          {traceur && <label className="champ">Épaisseur ({fmt(r.epaisseur)} mm)<input type="range" min={0.2} max={r.outil === "gomme" ? 40 : 6} step={0.1} value={r.epaisseur} onChange={(e) => r.setEpaisseur(Number(e.target.value))} /></label>}
          {r.outil !== "gomme" && <label className="champ">{r.outil === "remplir" ? "Couleur de la zone" : "Couleur du trait"}<input type="color" value={r.couleurTrait} onChange={(e) => r.setCouleurTrait(e.target.value)} style={{ minHeight: 44 }} /></label>}
          {(r.outil === "rect" || r.outil === "ellipse") && (
            <label className="champ">Remplissage
              <div className="row" style={{ flexWrap: "nowrap" }}>
                <input type="color" value={r.plein ?? "#ffffff"} onChange={(e) => r.setPlein(e.target.value)} style={{ minHeight: 44, flex: 1 }} />
                <button className="btn small" aria-pressed={r.plein === null} onClick={() => r.setPlein(null)}>Vide</button>
              </div>
            </label>
          )}
          {r.outil === "remplir" && <label className="champ">Tolérance ({r.tolerance})<input type="range" min={10} max={160} value={r.tolerance} onChange={(e) => r.setTolerance(Number(e.target.value))} /></label>}
        </div>
      )}
      {r.outil === "remplir" && <p className="note">Si la couleur déborde par une surpiqûre en pointillés, baisse la tolérance, ou ferme la zone avec un trait avant de remplir.</p>}

      {r.outil === "allonger" && (
        <div className="carte stack" style={{ gap: 10 }}>
          <div className="seg" role="group" aria-label="Sens">
            <button aria-pressed={(coupe?.axe ?? "v") === "v"} onClick={() => set({ coupe: coupe ? { ...coupe, axe: "v" } : { axe: "v", pos: 0 } })}>Longueur (coupe horizontale)</button>
            <button aria-pressed={coupe?.axe === "h"} onClick={() => set({ coupe: coupe ? { ...coupe, axe: "h" } : { axe: "h", pos: 0 } })}>Largeur (coupe verticale)</button>
          </div>
          <p className="note" style={{ margin: 0 }}>{coupe ? `Coupe à ${fmt(coupe.pos / 10)} cm ${coupe.axe === "v" ? "sous le haut du dessin" : "du milieu"}. ` : "Touche le dessin pour placer la ligne de coupe. "}Exemples : coupe au-dessus du bas pour rallonger le corps, au milieu de la manche pour la raccourcir.</p>
          <div className="row">
            <label className="champ" style={{ width: 160 }}>Différence (cm)<input type="text" inputMode="decimal" value={delta} onChange={(e) => setDelta(e.target.value)} /></label>
            <button className="btn primary" disabled={!coupe} onClick={appliquerCoupe}>Appliquer</button>
          </div>
          <p className="note" style={{ margin: 0 }}>Nombre positif : allonger ou élargir. Nombre négatif : raccourcir ou rétrécir.</p>
        </div>
      )}

      <div className="stack" style={{ gap: 8 }}>
        <span className="eyebrow">Sur la vue {NOMS_VUES[vue].toLowerCase()}</span>
        <div className="row">
          <button className="btn" disabled={!nb} onClick={() => modifier((p) => { p.retouches[vue] = (p.retouches[vue] || []).slice(0, -1); })}>Retirer le dernier trait ({nb})</button>
          <button className="btn danger" disabled={!nb} onClick={() => modifier((p) => { p.retouches[vue] = []; })}>Effacer tous les traits</button>
        </div>
        {modele && (
          <div className="row">
            <button className="btn" disabled={!ops.length} onClick={() => modifier((p) => { p.retouchesImage![vue] = ops.slice(0, -1); })}>Annuler la dernière retouche du dessin ({ops.length})</button>
            <button className="btn danger" disabled={!ops.length} onClick={() => modifier((p) => { p.retouchesImage![vue] = []; })}>Revenir au dessin d'origine</button>
          </div>
        )}
        <p className="note" style={{ margin: 0 }}>Le bouton « Annuler » en haut de l'écran fonctionne aussi pour tout. Dans le PSD, tes traits sont sur le calque « Retouches » et les zones colorées sur « Zones colorées ».</p>
      </div>

      <label className="champ">Notes pour la fiche
        <textarea id="f-notes" value={projet.notes} onChange={(e) => modifier((p) => { p.notes = e.target.value; }, "notes")} placeholder="Détails de confection, remarques…" />
      </label>
    </div>
  );
}
