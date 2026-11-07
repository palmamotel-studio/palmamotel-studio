import { useEffect, useState } from "react";
import { useEditeur } from "../etat/store";
import { mesuresDe } from "../etat/calcul";
import { supabase } from "../etat/donnees";
import { TAILLES, type Vue } from "../moteur/types";

/** Étape 2 pour un modèle du catalogue : quelle image pour chaque vue, et à quelle échelle. */
export function EtapeModele() {
  const { projet, modifier, taille, set } = useEditeur();
  const [urls, setUrls] = useState<Record<string, string>>({});
  const m = projet?.modele;
  useEffect(() => {
    if (!m) return;
    supabase.storage.from("marque").createSignedUrls(m.vues.map((v) => "catalogue/" + v.chemin), 3600).then(({ data }) => {
      const o: Record<string, string> = {};
      data?.forEach((d, i) => { if (d.signedUrl) o[m.vues[i].chemin] = d.signedUrl; });
      setUrls(o);
    });
  }, [m?.id]);
  if (!projet || !m) return null;
  const { cm } = mesuresDe(projet, taille);
  const saisie = projet.tableau[taille]?.largeur_dessin;

  return (
    <div className="stack">
      <div><span className="eyebrow">Étape 2</span><h2>Vues & échelle</h2></div>
      <p className="note">Modèle « {m.nom} » ({m.categorie}). Choisis l'image utilisée pour chaque vue du mock-up.</p>
      {(["face", "dos", "profil"] as Vue[]).map((v) => (
        <label key={v} className="champ">{v === "face" ? "Face" : v === "dos" ? "Dos" : "Profil"}
          <select value={m.correspondance[v] ?? ""} onChange={(e) => {
            const val = e.target.value === "" ? null : Number(e.target.value);
            modifier((p) => { p.modele!.correspondance[v] = val; });
            if (val !== null) set({ vue: v });
          }}>
            {v !== "face" && <option value="">Pas de vue {v === "dos" ? "dos" : "de profil"}</option>}
            {m.vues.map((x, i) => <option key={i} value={i}>{x.nom}</option>)}
          </select>
        </label>
      ))}
      <div className="row">
        {m.vues.map((x, i) => (
          <figure key={i} style={{ margin: 0, textAlign: "center" }}>
            {urls[x.chemin] ? <img src={urls[x.chemin]} alt={x.nom} style={{ height: 90, maxWidth: 120, objectFit: "contain", background: "#fff", borderRadius: 6, border: "1px solid var(--line)" }} /> : <div style={{ height: 90, width: 70 }} />}
            <figcaption className="note">{x.nom}</figcaption>
          </figure>
        ))}
      </div>
      <div className="seg tailles" role="group" aria-label="Taille">
        {TAILLES.map((t) => <button key={t} aria-pressed={taille === t} onClick={() => set({ taille: t })}>{t}</button>)}
      </div>
      <label className="champ">
        <span className="l">Largeur réelle de la vue de face ({taille}), en cm<span className="niveau recommande">recommandé</span></span>
        <input id="m-largeur_dessin" type="text" inputMode="decimal" value={saisie !== undefined ? String(saisie).replace(".", ",") : ""} placeholder={String(cm.largeur_dessin).replace(".", ",")}
          onChange={(e) => { const n = parseFloat(e.target.value.replace(",", ".")); modifier((p) => { const t = { ...(p.tableau[taille] || {}) }; if (Number.isFinite(n) && n > 0) t.largeur_dessin = n; else delete t.largeur_dessin; p.tableau[taille] = t; }, "larg"); }} />
      </label>
      <p className="note">Mesure le vêtement à plat d'un bout à l'autre, manches comprises, comme sur le dessin de face. Cette largeur fixe l'échelle : les étiquettes et patchs que tu poses gardent leur vraie taille, et l'export Procreate est à l'échelle. Les autres tailles suivent la gradation standard.</p>
      <p className="note">Le dessin vient d'une image : sa forme ne change pas avec les mesures. Pour un patronage exact, utilise une pièce dessinée sur mesures (catalogue « Nouveau mock-up dessiné »).</p>
    </div>
  );
}
