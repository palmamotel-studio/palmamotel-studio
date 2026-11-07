import { useEffect, useMemo, useState } from "react";
import type { Contexte } from "../App";
import { supabase, enregistrerProjet } from "../etat/donnees";
import { nouveauProjetModele, type VueModele } from "../etat/projet";
import { useEditeur } from "../etat/store";
import { largeurParDefaut } from "../gabarits/modele";

/** Entrée de l'index du catalogue (catalogue/index.json dans le stockage privé). */
interface EntreeCatalogue {
  id: string;
  nom: string;
  famille: string;
  categorie: string;
  vignette: string;
  vues: VueModele[];
}

const FAMILLES: [string, string][] = [["", "Tout"], ["hauts", "Hauts"], ["vestes", "Vestes"], ["bas", "Bas"], ["accessoires", "Accessoires"], ["nouveautes", "Nouveautés"]];
const PAR_PAGE = 48;
const urls = new Map<string, string>(); // chemin → URL signée (1 h)

async function signer(chemins: string[]) {
  const manquants = chemins.filter((c) => !urls.has(c));
  for (let i = 0; i < manquants.length; i += 100) {
    const lot = manquants.slice(i, i + 100).map((c) => "catalogue/" + c);
    const { data } = await supabase.storage.from("marque").createSignedUrls(lot, 3600);
    data?.forEach((d, j) => { if (d.signedUrl) urls.set(manquants[i + j], d.signedUrl); });
  }
}

/** Catalogue des modèles (pack Opus), rangé par famille et catégorie. */
export function Catalogue({ ctx, numero }: { ctx: Contexte; numero: number }) {
  const ouvrir = useEditeur((s) => s.ouvrir);
  const [index, setIndex] = useState<EntreeCatalogue[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [famille, setFamille] = useState("");
  const [categorie, setCategorie] = useState("");
  const [recherche, setRecherche] = useState("");
  const [page, setPage] = useState(1);
  const [choisi, setChoisi] = useState<EntreeCatalogue | null>(null);
  const [, setVersion] = useState(0);

  useEffect(() => {
    if (ctx.mode !== "partage") return;
    supabase.storage.from("marque").download("catalogue/index.json").then(async ({ data, error }) => {
      if (error || !data) { setErreur("Le catalogue n'est pas encore disponible."); return; }
      setIndex(JSON.parse(await data.text()));
    });
  }, [ctx.mode]);

  const categories = useMemo(() => [...new Set((index || []).filter((e) => !famille || e.famille === famille).map((e) => e.categorie))].sort(), [index, famille]);
  const liste = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return (index || []).filter((e) => (!famille || e.famille === famille) && (!categorie || e.categorie === categorie) && (!q || e.nom.toLowerCase().includes(q) || e.categorie.toLowerCase().includes(q)));
  }, [index, famille, categorie, recherche]);
  const visibles = liste.slice(0, page * PAR_PAGE);

  useEffect(() => { signer(visibles.map((e) => e.vignette)).then(() => setVersion((v) => v + 1)); }, [visibles.map((e) => e.id).join()]);
  useEffect(() => { if (choisi) signer(choisi.vues.map((v) => v.chemin)).then(() => setVersion((v) => v + 1)); }, [choisi?.id]);

  if (ctx.mode !== "partage") return <div className="bientot">Le catalogue est dans l'espace privé : connecte-toi pour y accéder.</div>;
  if (erreur) return <div className="bientot">{erreur}</div>;
  if (!index) return <p className="muted">Chargement du catalogue…</p>;

  async function creer(e: EntreeCatalogue) {
    const p = nouveauProjetModele({ id: e.id, nom: e.nom, famille: e.famille, categorie: e.categorie, vues: e.vues }, numero);
    const face = e.vues[p.modele!.correspondance.face ?? 0];
    p.tableau = { M: { largeur_dessin: largeurParDefaut(e.famille, face?.nom ?? "") } };
    await enregistrerProjet(ctx.mode, p, ctx.email).catch(() => {});
    ouvrir(p);
  }

  return (
    <div className="stack">
      <div className="seg" role="group" aria-label="Famille">
        {FAMILLES.map(([id, nom]) => (
          <button key={id} aria-pressed={famille === id} onClick={() => { setFamille(id); setCategorie(""); setPage(1); }}>
            {nom} <span className="muted">{(index || []).filter((e) => !id || e.famille === id).length}</span>
          </button>
        ))}
      </div>
      <div className="row">
        <select aria-label="Catégorie" value={categorie} onChange={(e) => { setCategorie(e.target.value); setPage(1); }} style={{ width: "auto", minWidth: 220 }}>
          <option value="">Toutes les catégories</option>
          {categories.map((c) => <option key={c}>{c}</option>)}
        </select>
        <input type="text" placeholder="Rechercher : hoodie, cargo, varsity…" value={recherche} onChange={(e) => { setRecherche(e.target.value); setPage(1); }} style={{ flex: "1 1 220px", width: "auto" }} />
        <span className="note">{liste.length} modèle{liste.length > 1 ? "s" : ""}</span>
      </div>

      {choisi && (
        <div className="carte stack" style={{ gap: 10 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div><b>{choisi.nom}</b><div className="note">{choisi.categorie} · {choisi.vues.length} vue{choisi.vues.length > 1 ? "s" : ""}</div></div>
            <div className="row">
              <button className="btn primary" onClick={() => creer(choisi)}>Créer un mock-up avec ce modèle</button>
              <button className="btn ghost" onClick={() => setChoisi(null)}>Fermer</button>
            </div>
          </div>
          <div className="row" style={{ alignItems: "flex-end" }}>
            {choisi.vues.map((v) => (
              <figure key={v.chemin} style={{ margin: 0, display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
                {urls.get(v.chemin) ? <img src={urls.get(v.chemin)} alt={v.nom} style={{ height: 160, maxWidth: 220, objectFit: "contain", background: "#fff", borderRadius: 8, border: "1px solid var(--line)" }} /> : <div style={{ height: 160, width: 120 }} />}
                <figcaption className="note">{v.nom}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      )}

      <div className="pieces" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>
        {visibles.map((e) => (
          <button key={e.id} className="piece" style={{ padding: 6, outline: choisi?.id === e.id ? "3px solid var(--accent)" : undefined }} onClick={() => setChoisi(e)}>
            <div style={{ aspectRatio: "1", background: "#fff", borderRadius: 6, display: "grid", placeItems: "center", overflow: "hidden" }}>
              {urls.get(e.vignette) && <img src={urls.get(e.vignette)} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "contain" }} />}
            </div>
            <span style={{ fontSize: 13, lineHeight: 1.25 }}>{e.nom}</span>
            <small>{e.categorie}</small>
          </button>
        ))}
      </div>
      {visibles.length < liste.length && <button className="btn" onClick={() => setPage(page + 1)}>Voir plus ({liste.length - visibles.length} restants)</button>}
    </div>
  );
}
