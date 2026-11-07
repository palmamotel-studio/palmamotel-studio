import { useEffect, useMemo, useRef, useState } from "react";
import type { Contexte } from "../App";
import { CATALOGUE } from "../gabarits";
import { NOMS_FAMILLES, type Famille } from "../moteur/types";
import { listerProjets, ecouterProjets, supprimerProjet, enregistrerProjet, type ResumeProjet } from "../etat/donnees";
import { nouveauProjet, normaliser, nouvelId } from "../etat/projet";
import { useEditeur } from "../etat/store";
import { rendreProjet } from "../etat/calcul";
import { svgDe } from "../moteur/rendu";
import { Generateur } from "./Generateur";
import { Comparaison } from "./Comparaison";

function Vignette({ r }: { r: ResumeProjet }) {
  const svg = useMemo(() => {
    try { return svgDe(rendreProjet(r.data, "face", r.data.tailleRef, "v" + r.id.slice(0, 8))); } catch { return ""; }
  }, [r]);
  return <div className="vignette" dangerouslySetInnerHTML={{ __html: svg }} />;
}

export function Accueil({ ctx }: { ctx: Contexte }) {
  const ouvrir = useEditeur((s) => s.ouvrir);
  const [projets, setProjets] = useState<ResumeProjet[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [aSupprimer, setASupprimer] = useState<string | null>(null);
  const [comparer, setComparer] = useState<string[] | null>(null);
  const [comparaison, setComparaison] = useState<[ResumeProjet, ResumeProjet] | null>(null);
  const fichier = useRef<HTMLInputElement>(null);

  const charger = () =>
    listerProjets(ctx.mode).then(setProjets).catch((e) => { setErreur("Impossible de charger les projets : " + (e?.message || "erreur réseau")); setProjets([]); });

  useEffect(() => {
    charger();
    if (ctx.mode === "partage") return ecouterProjets(charger);
  }, [ctx.mode]);

  const creer = (id: string) => ouvrir(nouveauProjet(id, (projets?.length || 0) + 1));

  async function importer(f: File) {
    try {
      const p = normaliser(JSON.parse(await f.text()));
      if (!p) throw new Error();
      p.id = nouvelId();
      await enregistrerProjet(ctx.mode, p, ctx.email);
      ouvrir(p);
    } catch {
      setErreur("Ce fichier n'est pas un projet Palma Motel Studio (.palma.json).");
    }
  }

  const familles = Object.keys(NOMS_FAMILLES) as Famille[];
  if (comparaison) return <Comparaison a={comparaison[0]} b={comparaison[1]} fermer={() => { setComparaison(null); setComparer(null); }} />;
  const choisir = (r: ResumeProjet) => {
    if (!comparer) return ouvrir(r.data);
    const l = comparer.includes(r.id) ? comparer.filter((x) => x !== r.id) : [...comparer, r.id].slice(-2);
    setComparer(l);
    if (l.length === 2) setComparaison([projets!.find((x) => x.id === l[0])!, projets!.find((x) => x.id === l[1])!]);
  };
  return (
    <div className="page">
      <header className="entete">
        <span className="logo">palmamotel</span>
        <span className="eyebrow">Studio de mock-ups</span>
        <span className="spacer" />
        <span className="note">{ctx.mode === "partage" ? `Espace partagé · ${ctx.email}` : "Mode local : projets sur cet appareil uniquement"}</span>
        <button className="btn small" onClick={ctx.quitter}>{ctx.mode === "partage" ? "Se déconnecter" : "Se connecter"}</button>
      </header>

      {erreur && <div className="erreur">{erreur}</div>}

      <section className="stack">
        <h2 style={{ fontFamily: "var(--f-head)", fontStretch: "85%", fontSize: 22 }}>Générer à partir de dessins</h2>
        <Generateur ctx={ctx} numero={(projets?.length || 0) + 1} />
      </section>

      <section className="stack">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h1 style={{ fontFamily: "var(--f-head)", fontStretch: "85%", fontSize: 26 }}>Vos mock-ups</h1>
          <div className="row">
            {(projets?.length || 0) >= 2 && <button className="btn" aria-pressed={!!comparer} onClick={() => setComparer(comparer ? null : [])}>{comparer ? "Annuler la comparaison" : "Comparer deux mock-ups"}</button>}
            <button className="btn" onClick={() => fichier.current?.click()}>Importer un projet (.json)</button>
            <input ref={fichier} type="file" accept=".json,application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importer(f); e.target.value = ""; }} />
          </div>
        </div>
        {projets === null ? (
          <p className="muted">Chargement…</p>
        ) : projets.length === 0 ? (
          <p className="muted">Aucun mock-up pour l'instant. Choisis une pièce ci-dessous pour commencer.</p>
        ) : (
          <>
          {comparer && <p className="note" style={{ margin: 0 }}>Touche deux mock-ups à comparer ({comparer.length}/2).</p>}
          <div className="projets">
            {projets.map((r) => (
              <div key={r.id} style={{ position: "relative" }}>
                <button className="projet" style={{ width: "100%", outline: comparer?.includes(r.id) ? "3px solid var(--accent)" : undefined }} onClick={() => choisir(r)}>
                  <Vignette r={r} />
                  <div className="infos">
                    <span className="t">{r.nom}</span>
                    <span className="s mono">{r.data.reference} · {CATALOGUE.find((c) => c.id === r.gabarit)?.nom}</span>
                    <span className="s">Modifié le {new Date(r.maj_le).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}{r.maj_par ? ` par ${r.maj_par.split(".")[0]}` : ""}</span>
                  </div>
                </button>
                <div className="row" style={{ position: "absolute", top: 8, right: 8 }}>
                  {aSupprimer === r.id ? (
                    <>
                      <button className="btn small danger" onClick={async () => { await supprimerProjet(ctx.mode, r.id).catch(() => setErreur("Suppression impossible.")); setASupprimer(null); charger(); }}>Supprimer</button>
                      <button className="btn small" onClick={() => setASupprimer(null)}>Annuler</button>
                    </>
                  ) : (
                    <button className="btn small" aria-label={`Supprimer ${r.nom}`} onClick={() => setASupprimer(r.id)}>✕</button>
                  )}
                </div>
              </div>
            ))}
          </div>
          </>
        )}
      </section>

      <section className="catalogue">
        <h2 style={{ fontFamily: "var(--f-head)", fontStretch: "85%", fontSize: 22 }}>Nouveau mock-up</h2>
        {familles.map((f) => (
          <div key={f} className="famille">
            <span className="eyebrow">{NOMS_FAMILLES[f]}</span>
            <div className="pieces">
              {CATALOGUE.filter((c) => c.famille === f).map((c) => (
                <button key={c.id} className="piece" disabled={!c.gabarit} onClick={() => creer(c.id)}>
                  {c.nom}
                  <small>{c.gabarit ? "Disponible" : `Arrive en vague ${c.vague}`}</small>
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
