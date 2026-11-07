import { useEffect, useMemo, useState } from "react";
import type { Contexte } from "../App";
import { useEditeur } from "../etat/store";
import { mesuresDe, rendreProjet } from "../etat/calcul";
import { MATIERES, EFFETS, COUPES, type Projet } from "../etat/projet";
import { TAILLES, VUES, NOMS_VUES, type Taille, type Vue } from "../moteur/types";
import { valeurStandard } from "../moteur/tailles";
import { listerPalette, ajouterCouleur, supprimerCouleur, type CouleurMarque } from "../etat/donnees";
import { PREREGLAGES, avertissements, produire, emballer, livrer, taillePx, type Format, type Prereglage } from "../export/exporter";
import type { OutilRetouche } from "./Apercu";

const fmt = (n: number) => (Math.round(n * 10) / 10).toLocaleString("fr-FR");

/* ---------------- 1. Pièce ---------------- */
export function EtapePiece() {
  const { projet, modifier } = useEditeur();
  if (!projet) return null;
  const { g } = mesuresDe(projet, projet.tailleRef);
  const champ = (cle: "nom" | "reference" | "collection", lib: string, niveau: string, ph = "") => (
    <label className="champ">
      <span className="l">{lib}<span className={`niveau ${niveau}`}>{niveau === "recommande" ? "recommandé" : niveau}</span></span>
      <input id={`f-${cle}`} type="text" value={projet[cle]} placeholder={ph} onChange={(e) => modifier((p) => { p[cle] = e.target.value; }, "f-" + cle)} />
    </label>
  );
  return (
    <div className="stack">
      <div><span className="eyebrow">Étape 1</span><h2>La pièce</h2></div>
      <p className="note">Type de vêtement : <b style={{ color: "var(--ink)" }}>{g.nom}</b>.</p>
      {champ("nom", "Nom du modèle", "obligatoire", "ex. Hoodie Vacancy")}
      <div className="grid2">
        {champ("reference", "Référence interne", "recommande")}
        {champ("collection", "Collection / saison", "optionnel", "ex. Été 2027")}
      </div>
      <label className="champ">Cible
        <select id="f-cible" value={projet.cible} onChange={(e) => modifier((p) => { p.cible = e.target.value as Projet["cible"]; })}>
          <option value="unisexe">Unisexe</option><option value="homme">Homme</option><option value="femme">Femme</option><option value="enfant">Enfant</option>
        </select>
      </label>
      <div className="grid2">
        <label className="champ">Coupe
          <select id="f-coupe" value={projet.coupe} onChange={(e) => modifier((p) => { p.coupe = e.target.value as Projet["coupe"]; })}>
            {COUPES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="champ">Épaule / manche
          <select id="f-epaule" value={projet.epaule} onChange={(e) => modifier((p) => { p.epaule = e.target.value as Projet["epaule"]; })}>
            <option value="montee">Montée classique</option><option value="tombante">Épaule tombante</option><option value="raglan">Raglan (vague 2)</option>
          </select>
        </label>
      </div>
      <p className="note">La coupe et le type d'épaule sont rendus par les mesures (largeur d'épaules, poitrine, longueur). Une coupe oversize = des mesures plus grandes à l'étape suivante.</p>
      <label className="champ">Taille de référence du mock-up
        <div className="seg tailles" role="group">
          {TAILLES.map((t) => <button key={t} type="button" aria-pressed={projet.tailleRef === t} onClick={() => modifier((p) => { p.tailleRef = t; })}>{t}</button>)}
        </div>
      </label>
    </div>
  );
}

/* ---------------- 2. Tailles & mesures ---------------- */
export function EtapeMesures() {
  const { projet, modifier, taille, set, mesureActive } = useEditeur();
  if (!projet) return null;
  const { g, cm, mm } = mesuresDe(projet, taille);
  const saisies = projet.tableau[taille] || {};
  const alertes = g.controles?.(mm) || [];
  const ecrire = (cle: string, v: string) => {
    const n = parseFloat(v.replace(",", "."));
    modifier((p) => {
      const t = { ...(p.tableau[taille] || {}) };
      if (v.trim() === "" || !Number.isFinite(n)) delete t[cle]; else t[cle] = n;
      p.tableau[taille] = t;
    }, "m-" + cle);
  };
  return (
    <div className="stack">
      <div><span className="eyebrow">Étape 2</span><h2>Tailles & mesures</h2></div>
      <p className="note">Mesures en cm, prises à plat. Touche une mesure : sa cote s'affiche sur le dessin. Les cases en gris italique viennent du barème standard ; tes valeurs les remplacent.</p>
      <div className="seg tailles" role="group" aria-label="Taille modifiée">
        {TAILLES.map((t) => <button key={t} aria-pressed={taille === t} onClick={() => set({ taille: t })}>{t}{projet.tableau[t] && Object.keys(projet.tableau[t]!).length ? " •" : ""}</button>)}
      </div>
      {taille !== "M" && !Object.keys(saisies).length && (
        <p className="note">Les valeurs de {taille} sont calculées à partir de la M (gradation standard). Saisis-les ici seulement si ta pièce s'écarte du barème.</p>
      )}
      {alertes.map((a) => <div key={a.message} className="alerte">{a.message}</div>)}
      <div className="stack" style={{ gap: 8 }}>
        {g.mesures.map((d) => {
          const saisie = saisies[d.cle] !== undefined;
          const hors = cm[d.cle] < d.min || cm[d.cle] > d.max;
          return (
            <div key={d.cle} className={`mesure${mesureActive === d.cle ? " active" : ""}`} onPointerEnter={() => set({ mesureActive: d.cle })}>
              <div className="lib">{d.libelle} <span className={`niveau ${d.niveau}`}>{d.niveau === "recommande" ? "recommandé" : d.niveau}</span></div>
              <input
                id={`m-${d.cle}`}
                type="text"
                inputMode="decimal"
                className={saisie ? "" : "standard"}
                aria-label={`${d.libelle} en cm, taille ${taille}`}
                value={saisie ? String(saisies[d.cle]).replace(".", ",") : ""}
                placeholder={fmt(cm[d.cle])}
                onFocus={() => set({ mesureActive: d.cle })}
                onChange={(e) => ecrire(d.cle, e.target.value)}
              />
              <div className="aide">{d.aide} Standard {taille} : {fmt(valeurStandard(d, taille))} cm.{hors && <b style={{ color: "var(--danger)" }}> Valeur improbable (attendu {d.min}–{d.max} cm).</b>}</div>
            </div>
          );
        })}
      </div>
      {Object.keys(saisies).length > 0 && (
        <button className="btn ghost" onClick={() => modifier((p) => { delete p.tableau[taille]; })}>Revenir au barème standard pour la {taille}</button>
      )}
    </div>
  );
}

/* ---------------- 3. Matière & couleur ---------------- */
export function EtapeMatiere({ ctx }: { ctx: Contexte }) {
  const { projet, modifier } = useEditeur();
  const [palette, setPalette] = useState<CouleurMarque[]>([]);
  const [nouv, setNouv] = useState({ nom: "", pantone: "", hex: "#ECE2CC" });
  const charger = () => listerPalette(ctx.mode).then(setPalette).catch(() => {});
  useEffect(() => { charger(); }, []);
  if (!projet) return null;
  const c = projet.couleur;
  return (
    <div className="stack">
      <div><span className="eyebrow">Étape 3</span><h2>Matière & couleur</h2></div>
      <div className="grid2">
        <label className="champ">Type de matière
          <select id="f-matiere" value={projet.matiere.type} onChange={(e) => modifier((p) => { p.matiere.type = e.target.value; })}>
            {MATIERES.map((m) => <option key={m}>{m}</option>)}
          </select>
        </label>
        <label className="champ">Grammage (g/m²)
          <input id="f-grammage" type="number" inputMode="numeric" min={80} max={700} value={projet.matiere.grammage ?? ""} placeholder="ex. 400" onChange={(e) => modifier((p) => { p.matiere.grammage = e.target.value ? Number(e.target.value) : null; }, "gram")} />
        </label>
      </div>
      <label className="champ">Composition
        <input id="f-compo" type="text" value={projet.matiere.composition} placeholder="ex. 100 % coton bio" onChange={(e) => modifier((p) => { p.matiere.composition = e.target.value; }, "compo")} />
      </label>
      <label className="champ">Effet
        <select id="f-effet" value={projet.matiere.effet} onChange={(e) => modifier((p) => { p.matiere.effet = e.target.value; })}>
          {EFFETS.map((m) => <option key={m}>{m}</option>)}
        </select>
      </label>
      <p className="note">Le rendu visuel des effets (chiné, délavé…) et l'influence du grammage sur les plis arrivent en vague 2. Ces infos figurent déjà dans le projet.</p>

      <div className="stack" style={{ gap: 10 }}>
        <span className="eyebrow">Couleur</span>
        <div className="seg" role="group">
          <button aria-pressed={c.traitSeul} onClick={() => modifier((p) => { p.couleur.traitSeul = true; })}>Trait seul</button>
          <button aria-pressed={!c.traitSeul} onClick={() => modifier((p) => { p.couleur.traitSeul = false; })}>En couleur</button>
        </div>
        {!c.traitSeul && (
          <>
            <div className="grid2">
              <label className="champ">Couleur principale
                <input id="f-coul" type="color" value={c.principale} onChange={(e) => modifier((p) => { p.couleur.principale = e.target.value.toUpperCase(); }, "coul")} style={{ minHeight: 44, width: "100%" }} />
              </label>
              <label className="champ">Pantone TCX
                <input id="f-pantone" type="text" value={c.pantone} placeholder="ex. 13-1520 TCX" onChange={(e) => modifier((p) => { p.couleur.pantone = e.target.value; }, "pantone")} />
              </label>
            </div>
            <div className="alerte">Le rendu écran d'une couleur Pantone est une approximation : valide toujours sur un échantillon physique.</div>
            <div className="grid2">
              {([["cotes", "Bords-côtes"], ["interieur", "Intérieur (capuche, col)"], ["fil", "Fil de couture"]] as const).map(([k, lib]) => (
                <label key={k} className="champ">{lib}
                  <div className="row" style={{ flexWrap: "nowrap" }}>
                    <input type="color" value={c[k] ?? c.principale} onChange={(e) => modifier((p) => { p.couleur[k] = e.target.value.toUpperCase(); }, "c-" + k)} style={{ minHeight: 44, flex: 1 }} />
                    {c[k] && <button className="btn small ghost" onClick={() => modifier((p) => { p.couleur[k] = null; })}>Auto</button>}
                  </div>
                </label>
              ))}
              <label className="champ">Cordons / embouts
                <input type="color" value={c.accessoires} onChange={(e) => modifier((p) => { p.couleur.accessoires = e.target.value.toUpperCase(); }, "c-acc")} style={{ minHeight: 44 }} />
              </label>
            </div>
          </>
        )}
      </div>

      <div className="stack" style={{ gap: 10 }}>
        <span className="eyebrow">Palette de la marque</span>
        {palette.length === 0 ? <p className="note">Aucune couleur enregistrée. Ajoute vos couleurs Pantone ci-dessous ; elles seront partagées entre vous deux.</p> : (
          <div className="pastilles">
            {palette.map((p) => (
              <button key={p.id} className="pastille" title={`${p.nom}${p.pantone ? " · " + p.pantone : ""} · ${p.hex}`} style={{ background: p.hex }}
                aria-pressed={!c.traitSeul && c.principale.toLowerCase() === p.hex.toLowerCase()}
                onClick={() => modifier((pr) => { pr.couleur.traitSeul = false; pr.couleur.principale = p.hex; pr.couleur.pantone = p.pantone || ""; })}>
                <span className="x" role="button" aria-label={`Retirer ${p.nom}`} onClick={async (e) => { e.stopPropagation(); await supprimerCouleur(ctx.mode, p.id).catch(() => {}); charger(); }}>✕</span>
              </button>
            ))}
          </div>
        )}
        <div className="row" style={{ alignItems: "flex-end" }}>
          <label className="champ" style={{ flex: "1 1 120px" }}>Nom<input type="text" value={nouv.nom} placeholder="Rose motel" onChange={(e) => setNouv({ ...nouv, nom: e.target.value })} /></label>
          <label className="champ" style={{ flex: "1 1 120px" }}>Pantone<input type="text" value={nouv.pantone} placeholder="13-1520 TCX" onChange={(e) => setNouv({ ...nouv, pantone: e.target.value })} /></label>
          <label className="champ" style={{ width: 70 }}>Hex<input type="color" value={nouv.hex} onChange={(e) => setNouv({ ...nouv, hex: e.target.value.toUpperCase() })} style={{ minHeight: 44 }} /></label>
          <button className="btn" disabled={!nouv.nom.trim()} onClick={async () => { await ajouterCouleur(ctx.mode, { nom: nouv.nom.trim(), pantone: nouv.pantone.trim() || null, hex: nouv.hex }).catch(() => {}); setNouv({ nom: "", pantone: "", hex: nouv.hex }); charger(); }}>Ajouter</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- 4 & 5. Finitions, Éléments (vague 2) ---------------- */
export function EtapeBientot({ numero, titre, items }: { numero: number; titre: string; items: string[] }) {
  return (
    <div className="stack">
      <div><span className="eyebrow">Étape {numero}</span><h2>{titre}</h2></div>
      <div className="bientot">
        <b style={{ color: "var(--ink)" }}>Arrive en vague 2.</b>
        <ul>{items.map((i) => <li key={i}>{i}</li>)}</ul>
        <span>Tu peux passer cette étape : le mock-up est déjà exportable.</span>
      </div>
    </div>
  );
}

/* ---------------- 6. Retouches ---------------- */
export function EtapeRetouches({ outil, setOutil, epaisseur, setEpaisseur, couleurTrait, setCouleurTrait }: {
  outil: OutilRetouche; setOutil: (o: OutilRetouche) => void; epaisseur: number; setEpaisseur: (n: number) => void; couleurTrait: string; setCouleurTrait: (c: string) => void;
}) {
  const { projet, modifier, vue } = useEditeur();
  if (!projet) return null;
  const nb = projet.retouches[vue]?.length || 0;
  return (
    <div className="stack">
      <div><span className="eyebrow">Étape 6</span><h2>Retouches</h2></div>
      <div className="seg" role="group">
        <button aria-pressed={outil === "poignees"} onClick={() => setOutil("poignees")}>Ajuster la forme</button>
        <button aria-pressed={outil === "dessin"} onClick={() => setOutil("dessin")}>Dessin libre</button>
      </div>
      {outil === "poignees" ? (
        <p className="note">Fais glisser les points roses sur le dessin : longueur, poitrine, épaules, manche, bas. Les mesures se mettent à jour et restent exactes dans la fiche et l'export.</p>
      ) : (
        <>
          <p className="note">Dessine au doigt ou à l'Apple Pencil (surpiqûres, détails, annotations). Le dessin est exporté sur un calque « Retouches » séparé.</p>
          <div className="grid2">
            <label className="champ">Épaisseur ({fmt(epaisseur)} mm)<input type="range" min={0.3} max={4} step={0.1} value={epaisseur} onChange={(e) => setEpaisseur(Number(e.target.value))} /></label>
            <label className="champ">Couleur<input type="color" value={couleurTrait} onChange={(e) => setCouleurTrait(e.target.value)} style={{ minHeight: 44 }} /></label>
          </div>
          <div className="row">
            <button className="btn" disabled={!nb} onClick={() => modifier((p) => { p.retouches[vue] = p.retouches[vue].slice(0, -1); })}>Effacer le dernier trait</button>
            <button className="btn danger" disabled={!nb} onClick={() => modifier((p) => { p.retouches[vue] = []; })}>Tout effacer ({NOMS_VUES[vue].toLowerCase()})</button>
          </div>
        </>
      )}
      <label className="champ">Notes pour la fiche
        <textarea id="f-notes" value={projet.notes} onChange={(e) => modifier((p) => { p.notes = e.target.value; }, "notes")} placeholder="Détails de confection, remarques…" />
      </label>
    </div>
  );
}

/* ---------------- 7. Export ---------------- */
export function EtapeExport({ toast }: { toast: (s: string) => void }) {
  const { projet, modifier, taille } = useEditeur();
  const [pre, setPre] = useState<Prereglage>("procreate");
  const [dpi, setDpi] = useState(PREREGLAGES.procreate.dpi);
  const [formats, setFormats] = useState<Format[]>(["psd"]);
  const [vues, setVues] = useState<Vue[]>(["face", "dos"]);
  const [tailles, setTailles] = useState<Taille[]>([taille]);
  const [transparent, setTransparent] = useState(true);
  const [encours, setEncours] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const g = projet ? mesuresDe(projet, taille).g : null;
  const demande = { vues, tailles, formats, dpi, fondTransparent: transparent };
  const avert = useMemo(() => (projet && vues.length && tailles.length ? avertissements(projet, demande) : []), [projet, vues, tailles, formats, dpi]);
  if (!projet || !g) return null;
  const r = rendreProjet(projet, vues[0] || "face", tailles[0] || "M", "px");
  const px = taillePx(r, dpi);
  const zones = VUES.flatMap((v) => g.zones(mesuresDe(projet, projet.tailleRef).mm, v));

  const choisirPre = (p: Prereglage) => { setPre(p); setDpi(PREREGLAGES[p].dpi); setFormats(PREREGLAGES[p].formats); setTransparent(p !== "reseaux"); };
  const bascule = <T,>(l: T[], v: T) => (l.includes(v) ? l.filter((x) => x !== v) : [...l, v]);

  async function lancer() {
    setErreur(null);
    try {
      setEncours("Préparation…");
      const fichiers = await produire(projet!, demande, (t) => setEncours(`Rendu ${t}…`));
      const f = emballer(projet!, fichiers);
      setEncours(null);
      const mode = await livrer(f);
      toast(mode === "partage" ? "Partage ouvert : choisis Procreate, Fichiers ou AirDrop." : `Téléchargé : ${f.name}`);
    } catch (e: any) {
      setEncours(null);
      setErreur("Export impossible : " + (e?.message || "erreur inconnue") + ". Essaie un DPI plus bas.");
    }
  }

  const FORMATS: [Format, string][] = [["psd", "PSD en calques (Procreate)"], ["png", "PNG haute définition"], ["png_calques", "Un PNG par calque (.zip, pour Canva)"], ["svg", "SVG vectoriel"], ["json", "Projet .json (à rouvrir dans le studio)"]];
  return (
    <div className="stack">
      <div><span className="eyebrow">Étape 7</span><h2>Export</h2></div>
      <label className="champ">Destination
        <div className="seg" role="group">
          {(Object.keys(PREREGLAGES) as Prereglage[]).map((p) => <button key={p} aria-pressed={pre === p} onClick={() => choisirPre(p)}>{PREREGLAGES[p].nom}</button>)}
        </div>
      </label>
      <p className="note">{PREREGLAGES[pre].aide}</p>
      <label className="champ">Résolution
        <div className="seg" role="group">
          {[72, 150, 300, 600].map((d) => <button key={d} aria-pressed={dpi === d} onClick={() => setDpi(d)}>{d} DPI</button>)}
        </div>
      </label>
      <p className="note mono">Toile : {px.l} × {px.h} px · {fmt(r.viewBox.l / 10)} × {fmt(r.viewBox.h / 10)} cm à l'échelle réelle</p>
      <div className="stack" style={{ gap: 4 }}>
        <span className="eyebrow">Formats</span>
        {FORMATS.map(([f, lib]) => <label key={f} className="check"><input type="checkbox" checked={formats.includes(f)} onChange={() => setFormats(bascule(formats, f))} />{lib}</label>)}
      </div>
      <div className="grid2">
        <div className="stack" style={{ gap: 4 }}>
          <span className="eyebrow">Vues</span>
          {VUES.map((v) => <label key={v} className="check"><input type="checkbox" checked={vues.includes(v)} onChange={() => setVues(bascule(vues, v))} />{NOMS_VUES[v]}</label>)}
        </div>
        <div className="stack" style={{ gap: 4 }}>
          <span className="eyebrow">Tailles</span>
          {TAILLES.map((t) => <label key={t} className="check"><input type="checkbox" checked={tailles.includes(t)} onChange={() => setTailles(bascule(tailles, t))} />{t}</label>)}
        </div>
      </div>
      <label className="check"><input type="checkbox" checked={transparent} onChange={(e) => setTransparent(e.target.checked)} />Fond transparent</label>
      <div className="stack" style={{ gap: 4 }}>
        <span className="eyebrow">Zones d'impression (repères + calques « TON DESIGN ICI »)</span>
        {zones.map((z) => (
          <label key={z.vue + z.id} className="check">
            <input type="checkbox" checked={projet.zonesActives.includes(z.id)} onChange={() => modifier((p) => { p.zonesActives = bascule(p.zonesActives, z.id); })} />
            {NOMS_VUES[z.vue]} · {z.nom} <span className="muted mono">{fmt(z.l / 10)} × {fmt(z.h / 10)} cm</span>
          </label>
        ))}
      </div>
      {avert.map((a) => <div key={a} className="alerte">{a}</div>)}
      {erreur && <div className="erreur">{erreur}</div>}
      <button className="btn primary" disabled={!!encours || !formats.length || !vues.length || !tailles.length} onClick={lancer}>
        {encours || `Exporter (${vues.length * tailles.length} vue${vues.length * tailles.length > 1 ? "s" : ""})`}
      </button>
    </div>
  );
}
