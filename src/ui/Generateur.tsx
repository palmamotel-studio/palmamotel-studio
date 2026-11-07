import { useRef, useState } from "react";
import type { Contexte } from "../App";
import { preparerImage, generer, projetDepuisIA, type ResultatIA } from "../etat/generation";
import { enregistrerProjet } from "../etat/donnees";
import { useEditeur } from "../etat/store";
import { CATALOGUE } from "../gabarits";

/** Génère un mock-up à partir de dessins, photos et d'une description. */
export function Generateur({ ctx, numero }: { ctx: Contexte; numero: number }) {
  const ouvrir = useEditeur((s) => s.ouvrir);
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<{ media_type: string; data: string; apercu: string; nom: string }[]>([]);
  const [etat, setEtat] = useState<"repos" | "envoi">("repos");
  const [erreur, setErreur] = useState<string | null>(null);
  const [resultat, setResultat] = useState<ResultatIA | null>(null);
  const entree = useRef<HTMLInputElement>(null);

  async function ajouter(fichiers: FileList | File[]) {
    setErreur(null);
    const l = [...fichiers].filter((f) => f.type.startsWith("image/")).slice(0, 4 - images.length);
    try {
      const prets = await Promise.all(l.map(async (f) => ({ ...(await preparerImage(f)), nom: f.name })));
      setImages((x) => [...x, ...prets].slice(0, 4));
    } catch { setErreur("Une image n'a pas pu être lue. Formats : JPG, PNG, HEIC exporté en JPG."); }
  }

  async function lancer() {
    setErreur(null); setResultat(null); setEtat("envoi");
    try {
      setResultat(await generer(description, images.map(({ media_type, data }) => ({ media_type, data }))));
    } catch (e: any) {
      setErreur(e?.message || "Génération impossible.");
    }
    setEtat("repos");
  }

  async function creer() {
    if (!resultat) return;
    const p = projetDepuisIA(resultat, numero, description);
    await enregistrerProjet(ctx.mode, p, ctx.email).catch(() => {});
    ouvrir(p);
  }

  if (ctx.mode !== "partage") {
    return <div className="bientot">Le générateur à partir de dessins demande d'être connecté (il passe par l'espace partagé).</div>;
  }

  const piece = resultat && CATALOGUE.find((c) => c.id === resultat.gabaritId)?.nom;
  return (
    <div className="carte stack generateur" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); ajouter(e.dataTransfer.files); }}>
      <p className="note" style={{ margin: 0 }}>Dépose jusqu'à 4 dessins ou photos (croquis, flat, photo d'une pièce) et/ou décris le vêtement. Claude choisit la pièce, remplit la fiche et prépare le mock-up. Tu pourras tout ajuster ensuite.</p>
      <div className="row">
        {images.map((im, i) => (
          <div key={i} style={{ position: "relative" }}>
            <img src={im.apercu} alt={im.nom} style={{ width: 84, height: 84, objectFit: "cover", borderRadius: 8, border: "1px solid var(--line)" }} />
            <button className="btn small" style={{ position: "absolute", top: -8, right: -8, minHeight: 26, padding: "0 8px" }} aria-label={`Retirer ${im.nom}`} onClick={() => setImages(images.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
        {images.length < 4 && <button className="btn" onClick={() => entree.current?.click()}>+ Ajouter des dessins</button>}
        <input ref={entree} type="file" accept="image/*" multiple hidden onChange={(e) => { if (e.target.files) ajouter(e.target.files); e.target.value = ""; }} />
      </div>
      <label className="champ">Description
        <textarea id="gen-description" value={description} onChange={(e) => setDescription(e.target.value)}
          placeholder="ex. Hoodie zippé oversize, capuche doublée, poche kangourou, bords-côtes 2x2, molleton 400 g/m², couleur 13-1520 TCX, logo brodé au cœur, demi-poitrine 64 cm en M." />
      </label>
      {erreur && <div className="erreur">{erreur}</div>}
      <button className="btn primary" disabled={etat === "envoi" || (!description.trim() && !images.length)} onClick={lancer}>
        {etat === "envoi" ? "Analyse en cours… (20 à 60 s)" : "Générer le mock-up"}
      </button>
      {resultat && (
        <div className="stack" style={{ gap: 8 }}>
          <b>Proposition : {piece} · « {resultat.nom} »</b>
          <span className="note">
            {resultat.mesures.length ? `${resultat.mesures.length} mesure(s) reprise(s) en ${resultat.tailleRef}` : "Aucune mesure donnée : barème standard"}
            {" · "}{resultat.couleur.traitSeul ? "trait seul" : `couleur ${resultat.couleur.pantone || resultat.couleur.hex}`}
            {resultat.zones.length ? ` · zones : ${resultat.zones.join(", ")}` : ""}
          </span>
          {resultat.notes && <span className="note">{resultat.notes}</span>}
          {resultat.ecarts && <div className="alerte">À reprendre à la main : {resultat.ecarts}</div>}
          <div className="row">
            <button className="btn pool" onClick={creer}>Créer ce mock-up</button>
            <button className="btn ghost" onClick={() => setResultat(null)}>Rejeter</button>
          </div>
        </div>
      )}
    </div>
  );
}
