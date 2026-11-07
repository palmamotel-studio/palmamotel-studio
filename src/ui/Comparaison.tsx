import { useMemo, useState } from "react";
import type { ResumeProjet } from "../etat/donnees";
import { mesuresDe, rendreProjet } from "../etat/calcul";
import { svgDe } from "../moteur/rendu";
import { NOMS_VUES, TAILLES, VUES, type Taille, type Vue } from "../moteur/types";
import { CATALOGUE } from "../gabarits";

/** Deux mock-ups côte à côte, avec le tableau de leurs différences. */
export function Comparaison({ a, b, fermer }: { a: ResumeProjet; b: ResumeProjet; fermer: () => void }) {
  const [vue, setVue] = useState<Vue>("face");
  const [taille, setTaille] = useState<Taille>("M");
  const svgs = useMemo(() => [a, b].map((r, i) => {
    const g = mesuresDe(r.data, taille).g;
    const v = (g.vues ?? VUES).includes(vue) ? vue : "face";
    return svgDe(rendreProjet(r.data, v, taille, `cmp${i}`));
  }), [a, b, vue, taille]);

  const ma = mesuresDe(a.data, taille), mb = mesuresDe(b.data, taille);
  const lignes: [string, string, string][] = [
    ["Pièce", ma.g.nom, mb.g.nom],
    ["Couleur", a.data.couleur.traitSeul ? "trait seul" : `${a.data.couleur.principale} ${a.data.couleur.pantone}`, b.data.couleur.traitSeul ? "trait seul" : `${b.data.couleur.principale} ${b.data.couleur.pantone}`],
    ["Matière", `${a.data.matiere.type} ${a.data.matiere.grammage ?? ""}`, `${b.data.matiere.type} ${b.data.matiere.grammage ?? ""}`],
    ["Effet", a.data.matiere.effet, b.data.matiere.effet],
    ["Éléments", String(a.data.elements.length), String(b.data.elements.length)],
    ...ma.g.mesures.filter((d) => mb.cm[d.cle] !== undefined).map((d) => [d.libelle + ` (${taille})`, `${ma.cm[d.cle]} cm`, `${mb.cm[d.cle]} cm`] as [string, string, string]),
  ];
  return (
    <div className="page">
      <header className="entete">
        <button className="btn small" onClick={fermer}>← Retour</button>
        <h1 style={{ fontFamily: "var(--f-head)", fontStretch: "85%", fontSize: 24 }}>Comparaison</h1>
        <span className="spacer" />
        <div className="seg" role="group">{(["face", "dos", "profil"] as Vue[]).map((v) => <button key={v} aria-pressed={vue === v} onClick={() => setVue(v)}>{NOMS_VUES[v]}</button>)}</div>
        <div className="seg tailles" role="group">{TAILLES.map((t) => <button key={t} aria-pressed={taille === t} onClick={() => setTaille(t)}>{t}</button>)}</div>
      </header>
      <div className="grid2">
        {[a, b].map((r, i) => (
          <div key={r.id} className="carte stack" style={{ gap: 8 }}>
            <b>{r.nom}</b>
            <span className="note mono">{r.data.reference} · {CATALOGUE.find((c) => c.id === r.gabarit)?.nom}</span>
            <div style={{ background: "#fff", borderRadius: 10, aspectRatio: "1", display: "grid", placeItems: "center" }} dangerouslySetInnerHTML={{ __html: svgs[i].replace(/width="[^"]+mm" height="[^"]+mm"/, 'width="100%" height="100%"') }} />
          </div>
        ))}
      </div>
      <div className="carte" style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead><tr><th style={{ textAlign: "left", padding: 6 }}></th><th style={{ textAlign: "left", padding: 6 }}>{a.nom}</th><th style={{ textAlign: "left", padding: 6 }}>{b.nom}</th></tr></thead>
          <tbody>
            {lignes.map(([lib, va, vb]) => (
              <tr key={lib} style={{ background: va !== vb ? "color-mix(in srgb, var(--accent) 10%, transparent)" : undefined }}>
                <td style={{ padding: 6, color: "var(--muted)" }}>{lib}</td><td style={{ padding: 6 }} className="mono">{va}</td><td style={{ padding: 6 }} className="mono">{vb}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="note">Les lignes surlignées diffèrent entre les deux mock-ups.</p>
      </div>
    </div>
  );
}
