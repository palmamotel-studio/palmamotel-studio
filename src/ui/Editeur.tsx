import { useEffect, useMemo, useRef, useState } from "react";
import type { Contexte } from "../App";
import { useEditeur, ETAPES, type Etape } from "../etat/store";
import { enregistrerProjet, ecouterProjets, listerProjets } from "../etat/donnees";
import { precisionProjet } from "../etat/calcul";
import { Apercu, type OutilRetouche } from "./Apercu";
import { EtapePiece, EtapeMesures, EtapeMatiere, EtapeRetouches, EtapeExport } from "./Etapes";
import { EtapeFinitions, EtapeElements } from "./EtapesVague2";

export function Editeur({ ctx }: { ctx: Contexte }) {
  const { projet, etape, set, fermer, annuler, retablir, passe, futur, modifie, marquerEnregistre, remplacerDepuisDistant } = useEditeur();
  const [statut, setStatut] = useState<"ok" | "encours" | "erreur">("ok");
  const [voirManquantes, setVoirManquantes] = useState(false);
  const [outil, setOutil] = useState<OutilRetouche>(() => (useEditeur.getState().projet?.modele ? "main" : "poignees"));
  const [epaisseur, setEpaisseur] = useState(0.8);
  const [couleurTrait, setCouleurTrait] = useState("#1b1b1b");
  const [plein, setPlein] = useState<string | null>(null);
  const [tolerance, setTolerance] = useState(60);
  const [message, setMessage] = useState<string | null>(null);
  const minuteur = useRef<number>();

  const toast = (s: string) => { setMessage(s); window.setTimeout(() => setMessage(null), 4000); };

  // Enregistrement automatique (1 s après la dernière modification).
  useEffect(() => {
    if (!projet || !modifie) return;
    setStatut("encours");
    window.clearTimeout(minuteur.current);
    minuteur.current = window.setTimeout(() => {
      enregistrerProjet(ctx.mode, projet, ctx.email)
        .then(() => { marquerEnregistre(); setStatut("ok"); })
        .catch(() => setStatut("erreur"));
    }, 1000);
  }, [projet, modifie]);

  // Si l'autre designer modifie ce projet pendant qu'on ne touche à rien, on recharge sa version.
  useEffect(() => {
    if (ctx.mode !== "partage" || !projet) return;
    const id = projet.id;
    return ecouterProjets(async () => {
      const etat = useEditeur.getState();
      if (etat.modifie || etat.projet?.id !== id) return;
      const l = await listerProjets("partage").catch(() => null);
      const r = l?.find((x) => x.id === id);
      if (r && r.maj_par !== ctx.email && JSON.stringify(r.data) !== JSON.stringify(etat.projet)) {
        remplacerDepuisDistant(r.data);
        toast(`Mis à jour par ${r.maj_par?.split(".")[0] ?? "l'autre designer"}.`);
      }
    });
  }, [projet?.id, ctx.mode]);

  // Raccourcis clavier : annuler / rétablir.
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") return;
      if ((e.target as HTMLElement)?.tagName === "INPUT" || (e.target as HTMLElement)?.tagName === "TEXTAREA") return;
      e.preventDefault();
      e.shiftKey ? retablir() : annuler();
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);

  const precision = useMemo(() => (projet ? precisionProjet(projet) : null), [projet]);
  if (!projet || !precision) return null;
  // Un modèle du catalogue n'a pas de finitions (elles sont dans l'image).
  const etapes = projet.modele ? ETAPES.filter((e) => e.id !== "finitions").map((e) => (e.id === "mesures" ? { ...e, nom: "Vues & échelle" } : e)) : ETAPES;
  const idx = etapes.findIndex((e) => e.id === etape);
  const aller = (e: Etape) => { set({ etape: e }); setVoirManquantes(false); };

  async function retour() {
    if (modifie) {
      setStatut("encours");
      await enregistrerProjet(ctx.mode, projet!, ctx.email).catch(() => {});
    }
    fermer();
  }

  return (
    <div className="editeur">
      <header className="barre">
        <button className="btn small" onClick={retour} aria-label="Retour aux projets">← Projets</button>
        <div className="titre">
          <b>{projet.nom}</b>
          <span className="statut mono" data-s={statut}>
            <span className={`statut ${statut === "ok" ? "" : statut}`}><i />{statut === "ok" ? "Enregistré" : statut === "encours" ? "Enregistrement…" : "Non enregistré (hors ligne ?)"}</span>
            · {projet.reference}
          </span>
        </div>
        <span className="spacer" />
        <button className="btn small" onClick={annuler} disabled={!passe.length} aria-label="Annuler">↶ Annuler</button>
        <button className="btn small" onClick={retablir} disabled={!futur.length} aria-label="Rétablir">↷ Rétablir</button>
        {!projet.modele && <button className="score" onClick={() => setVoirManquantes(!voirManquantes)} aria-expanded={voirManquantes} title="Précision du mock-up">
          Précision {precision.score} %
          <span className="jauge"><i style={{ width: `${precision.score}%` }} /></span>
        </button>}
      </header>

      {voirManquantes && (
        <div className="manquantes" role="dialog" aria-label="Informations manquantes">
          <b>Pour améliorer la précision</b>
          {precision.manquantes.length === 0 ? <p className="note">Tout est renseigné.</p> : precision.manquantes.map((m) => (
            <button key={m.cle} onClick={() => { aller(m.etape as Etape); if (m.etape === "mesures") set({ taille: projet.tailleRef, mesureActive: m.cle }); setTimeout(() => document.getElementById((m.etape === "mesures" ? "m-" : "f-") + m.cle)?.focus(), 80); }}>
              <span>{m.libelle}</span><span className={`niveau ${m.niveau}`}>{m.niveau === "recommande" ? "recommandé" : m.niveau}</span>
            </button>
          ))}
          <p className="note">Les mesures comptent quand elles sont saisies en taille {projet.tailleRef} (taille de référence).</p>
        </div>
      )}

      <nav className="etapes" aria-label="Étapes">
        {etapes.map((e, i) => (
          <button key={e.id} aria-current={etape === e.id ? "step" : undefined} className={i < idx ? "fait" : ""} onClick={() => aller(e.id)}>
            <span className="n">{i + 1}</span>{e.nom}
          </button>
        ))}
      </nav>

      <div className="corps">
        <Apercu outil={etape === "retouches" ? outil : etape === "elements" ? "elements" : null} epaisseur={epaisseur} couleurTrait={couleurTrait} plein={plein} tolerance={tolerance} />
        <aside className="panneau">
          <div className="contenu">
            {etape === "piece" && <EtapePiece />}
            {etape === "mesures" && <EtapeMesures />}
            {etape === "matiere" && <EtapeMatiere ctx={ctx} />}
            {etape === "finitions" && <EtapeFinitions />}
            {etape === "elements" && <EtapeElements ctx={ctx} />}
            {etape === "retouches" && <EtapeRetouches outil={outil} setOutil={setOutil} epaisseur={epaisseur} setEpaisseur={setEpaisseur} couleurTrait={couleurTrait} setCouleurTrait={setCouleurTrait} plein={plein} setPlein={setPlein} tolerance={tolerance} setTolerance={setTolerance} />}
            {etape === "export" && <EtapeExport toast={toast} ctx={ctx} />}
          </div>
          <div className="nav">
            <button className="btn" disabled={idx === 0} onClick={() => aller(etapes[idx - 1].id)}>← {idx > 0 ? etapes[idx - 1].nom : "Précédent"}</button>
            {idx < etapes.length - 1 && <button className="btn primary" onClick={() => aller(etapes[idx + 1].id)}>{etapes[idx + 1].nom} →</button>}
          </div>
        </aside>
      </div>
      {message && <div className="toast" role="status">{message}</div>}
    </div>
  );
}
