import { useEffect, useRef, useState } from "react";
import type { Contexte } from "../App";
import { useEditeur } from "../etat/store";
import { mesuresDe } from "../etat/calcul";
import { nouvelId } from "../etat/projet";
import { NOMS_VUES, type Finitions, type Vue } from "../moteur/types";
import { TYPES_ELEMENTS, nomType, positionParDefaut, type Element, type TypeElement } from "../moteur/elements";
import { importerVisuel, urlVisuel, useVisuels } from "../etat/visuels";
import { supabase } from "../etat/donnees";

/* ---------------- 4. Finitions ---------------- */
const CHOIX: { [K in keyof Finitions]?: { lib: string; options: [Finitions[K], string][] } } = {
  piqure: { lib: "Surpiqûres", options: [["simple", "Simple aiguille"], ["double", "Double aiguille"]] },
  cotes: { lib: "Bords-côtes", options: [["1x1", "Côte 1x1"], ["2x2", "Côte 2x2"]] },
  bas: { lib: "Bas du vêtement", options: [["droit", "Droit"], ["arrondi", "Arrondi"], ["fentes", "Fentes de côté"]] },
  cordon: { lib: "Cordons de capuche", options: [["rond", "Ronds"], ["plat", "Plats"]] },
  embout: { lib: "Embouts", options: [["metal", "Métal"], ["plastique", "Plastique"], ["silicone", "Silicone"], ["noeud", "Nœud"]] },
  oeillet: { lib: "Œillets", options: [["metal", "Métal"], ["brode", "Brodés"]] },
  zip: { lib: "Zip", options: [["metal", "Métal"], ["plastique", "Plastique (Vislon)"], ["invisible", "Invisible"]] },
};

export function EtapeFinitions() {
  const { projet, modifier } = useEditeur();
  if (!projet) return null;
  const { g } = mesuresDe(projet, projet.tailleRef);
  const f = projet.finitions;
  const c = projet.couleur;
  return (
    <div className="stack">
      <div><span className="eyebrow">Étape 4</span><h2>Finitions</h2></div>
      <p className="note">Seules les finitions qui existent sur un {g.nom.toLowerCase()} sont proposées.</p>
      {g.finitions.map((k) => {
        if (k === "bandeProprete")
          return <label key={k} className="check"><input type="checkbox" checked={f.bandeProprete} onChange={(e) => modifier((p) => { p.finitions.bandeProprete = e.target.checked; })} />Bande de propreté au col dos</label>;
        if (k === "couleurZip")
          return (
            <label key={k} className="champ">Couleur du zip
              <input type="color" value={f.couleurZip} onChange={(e) => modifier((p) => { p.finitions.couleurZip = e.target.value.toUpperCase(); }, "zipc")} style={{ minHeight: 44 }} />
            </label>
          );
        const ch = CHOIX[k];
        if (!ch) return null;
        return (
          <label key={k} className="champ">{ch.lib}
            <div className="seg" role="group">
              {ch.options.map(([v, lib]) => (
                <button key={String(v)} type="button" aria-pressed={f[k] === v} onClick={() => modifier((p) => { (p.finitions as any)[k] = v; })}>{lib}</button>
              ))}
            </div>
          </label>
        );
      })}
      <label className="champ">Couleur du fil de couture
        <div className="row" style={{ flexWrap: "nowrap" }}>
          <input type="color" value={c.fil ?? "#1b1b1b"} onChange={(e) => modifier((p) => { p.couleur.fil = e.target.value.toUpperCase(); }, "fil")} style={{ minHeight: 44, flex: 1 }} />
          {c.fil && <button className="btn small ghost" onClick={() => modifier((p) => { p.couleur.fil = null; })}>Auto</button>}
        </div>
      </label>
      {c.traitSeul && c.fil && <p className="note">En « trait seul », le fil reste visible : pratique pour montrer une surpiqûre contrastée.</p>}
    </div>
  );
}

/* ---------------- 5. Éléments ---------------- */
interface Modele { id: string; nom: string; meta: Partial<Element> }

export function EtapeElements({ ctx }: { ctx: Contexte }) {
  const { projet, modifier, vue, taille, set, elementActif } = useEditeur();
  useVisuels((s) => s.version);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [modeles, setModeles] = useState<Modele[]>([]);
  const fichier = useRef<HTMLInputElement>(null);

  const chargerModeles = async () => {
    if (ctx.mode !== "partage") {
      try { setModeles(JSON.parse(localStorage.getItem("palma-studio-modeles") || "[]")); } catch { setModeles([]); }
      return;
    }
    const { data } = await supabase.from("bibliotheque").select("id, nom, meta").order("cree_le", { ascending: false });
    setModeles((data as Modele[]) || []);
  };
  useEffect(() => { chargerModeles(); }, []);
  if (!projet) return null;
  const { mm } = mesuresDe(projet, taille);
  const sel = projet.elements.find((e) => e.id === elementActif) || null;
  const deCetteVue = projet.elements.filter((e) => e.vue === vue);

  function ajouter(type: TypeElement, base?: Partial<Element>) {
    const t = TYPES_ELEMENTS.find((x) => x.type === type)!;
    const pos = positionParDefaut(type, mm);
    const e: Element = {
      id: nouvelId(), type, vue: pos.vue, x: Math.round(pos.x), y: Math.round(pos.y), l: t.l, h: t.h, rotation: 0,
      couleur: t.couleur, matiere: t.matieres[0], forme: t.forme ?? "rect", texte: type === "etiquette_col" ? "palmamotel" : "", visuel: null,
      ...base,
    };
    modifier((p) => { p.elements.push(e); });
    set({ elementActif: e.id, vue: e.vue });
  }
  const maj = (f: (e: Element) => void, groupe?: string) => modifier((p) => { const e = p.elements.find((x) => x.id === elementActif); if (e) f(e); }, groupe);

  async function importer(f: File) {
    setErreur(null); setEnvoi(true);
    try {
      const ref = await importerVisuel(f, ctx.mode === "partage");
      maj((e) => { e.visuel = ref; });
    } catch (e: any) { setErreur(e?.message || "Import impossible."); }
    setEnvoi(false);
  }

  async function enregistrerModele() {
    if (!sel) return;
    const { id: _id, x: _x, y: _y, vue: _v, ...meta } = sel;
    const nom = `${nomType(sel.type)}${sel.texte ? " · " + sel.texte : ""} · ${sel.matiere}`;
    if (ctx.mode === "partage") {
      const { error } = await supabase.from("bibliotheque").insert({ type: sel.type, nom, chemin: sel.visuel?.startsWith("stockage:") ? sel.visuel.slice(9) : "", meta });
      if (error) { setErreur("Enregistrement impossible : " + error.message); return; }
    } else {
      try { localStorage.setItem("palma-studio-modeles", JSON.stringify([{ id: nouvelId(), nom, meta }, ...modeles])); } catch { /* stockage plein */ }
    }
    chargerModeles();
  }
  async function supprimerModele(id: string) {
    if (ctx.mode === "partage") await supabase.from("bibliotheque").delete().eq("id", id);
    else try { localStorage.setItem("palma-studio-modeles", JSON.stringify(modeles.filter((m) => m.id !== id))); } catch { /* ignoré */ }
    chargerModeles();
  }

  const def = sel ? TYPES_ELEMENTS.find((t) => t.type === sel.type)! : null;
  const cm = (v: number) => String(Math.round(v) / 10).replace(".", ",");
  const lireCm = (v: string) => Math.max(3, Math.round(parseFloat(v.replace(",", ".")) * 10) || 3);

  return (
    <div className="stack">
      <div><span className="eyebrow">Étape 5</span><h2>Éléments</h2></div>
      <p className="note">Ajoute étiquettes, patchs et accessoires. Fais-les glisser sur le dessin ; leurs dimensions sont réelles. Chaque élément devient un calque dans le PSD.</p>
      <div className="pieces">
        {TYPES_ELEMENTS.map((t) => <button key={t.type} className="piece" onClick={() => ajouter(t.type)}>{t.nom}<small>{t.l / 10} × {t.h / 10} cm</small></button>)}
      </div>

      {modeles.length > 0 && (
        <div className="stack" style={{ gap: 6 }}>
          <span className="eyebrow">Bibliothèque de la marque</span>
          {modeles.map((m) => (
            <div key={m.id} className="row" style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
              <button className="btn small" style={{ flex: 1, justifyContent: "flex-start" }} onClick={() => ajouter(m.meta.type as TypeElement, m.meta)}>+ {m.nom}</button>
              <button className="btn small ghost" aria-label={`Retirer ${m.nom} de la bibliothèque`} onClick={() => supprimerModele(m.id)}>✕</button>
            </div>
          ))}
        </div>
      )}

      <div className="stack" style={{ gap: 6 }}>
        <span className="eyebrow">Sur la vue {NOMS_VUES[vue].toLowerCase()} ({deCetteVue.length})</span>
        {deCetteVue.length === 0 && <p className="note">Aucun élément sur cette vue.</p>}
        {deCetteVue.map((e) => (
          <button key={e.id} className={`item${e.id === elementActif ? " sel" : ""}`} style={{ display: "flex", gap: 8, border: "1px solid var(--line)", borderRadius: 8, padding: "8px 10px", background: e.id === elementActif ? "var(--plan)" : "var(--surface)", textAlign: "left" }} onClick={() => set({ elementActif: e.id })}>
            <span style={{ width: 16, height: 16, borderRadius: 4, background: e.couleur, border: "1px solid var(--line)", flex: "none" }} />
            <span style={{ flex: 1 }}>{nomType(e.type)}{e.texte ? ` · ${e.texte}` : ""}</span>
            <span className="mono muted">{cm(e.l)} × {cm(e.h)} cm</span>
          </button>
        ))}
      </div>

      {sel && def && (
        <div className="carte stack" style={{ gap: 12 }}>
          <b>{nomType(sel.type)}</b>
          <div className="grid2">
            <label className="champ">Matière
              <select value={sel.matiere} onChange={(e) => maj((x) => { x.matiere = e.target.value; })}>{def.matieres.map((m) => <option key={m}>{m}</option>)}</select>
            </label>
            <label className="champ">Vue
              <select value={sel.vue} onChange={(e) => { const v = e.target.value as Vue; maj((x) => { x.vue = v; }); set({ vue: v }); }}>
                <option value="face">Face</option><option value="dos">Dos</option>
              </select>
            </label>
            <label className="champ">Largeur (cm)<input type="text" inputMode="decimal" defaultValue={cm(sel.l)} key={sel.id + "l" + sel.l} onBlur={(e) => maj((x) => { x.l = lireCm(e.target.value); })} /></label>
            <label className="champ">Hauteur (cm)<input type="text" inputMode="decimal" defaultValue={cm(sel.h)} key={sel.id + "h" + sel.h} onBlur={(e) => maj((x) => { x.h = lireCm(e.target.value); })} /></label>
            <label className="champ">Couleur<input type="color" value={sel.couleur} onChange={(e) => maj((x) => { x.couleur = e.target.value.toUpperCase(); }, "elc")} style={{ minHeight: 44 }} /></label>
            <label className="champ">Rotation ({sel.rotation}°)<input type="range" min={-90} max={90} value={sel.rotation} onChange={(e) => maj((x) => { x.rotation = Number(e.target.value); }, "elr")} /></label>
          </div>
          {sel.type === "patch" && (
            <div className="seg" role="group" aria-label="Forme">
              {(["rect", "rond", "ovale"] as const).map((f) => <button key={f} aria-pressed={sel.forme === f} onClick={() => maj((x) => { x.forme = f; if (f === "rond") x.h = x.l; })}>{f === "rect" ? "Rectangle" : f === "rond" ? "Rond" : "Ovale"}</button>)}
            </div>
          )}
          {!["bouton", "pression", "oeillet"].includes(sel.type) && (
            <>
              <label className="champ">Texte (si pas de visuel)<input type="text" value={sel.texte} placeholder={sel.type === "etiquette_taille" ? taille : ""} onChange={(e) => maj((x) => { x.texte = e.target.value; }, "elt")} /></label>
              <div className="row">
                <button className="btn" disabled={envoi} onClick={() => fichier.current?.click()}>{envoi ? "Envoi…" : sel.visuel ? "Changer le visuel" : "Importer un visuel (PNG, JPG, SVG)"}</button>
                {sel.visuel && <button className="btn ghost" onClick={() => maj((x) => { x.visuel = null; })}>Retirer le visuel</button>}
                {sel.visuel && !urlVisuel(sel.visuel) && <span className="note">Chargement du visuel…</span>}
              </div>
              <input ref={fichier} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importer(f); e.target.value = ""; }} />
            </>
          )}
          {erreur && <div className="erreur">{erreur}</div>}
          <div className="row">
            <button className="btn" onClick={enregistrerModele}>Enregistrer dans la bibliothèque</button>
            <button className="btn" onClick={() => { const c = { ...sel, id: nouvelId(), x: sel.x + 15, y: sel.y + 15 }; modifier((p) => { p.elements.push(c); }); set({ elementActif: c.id }); }}>Dupliquer</button>
            <button className="btn danger" onClick={() => { modifier((p) => { p.elements = p.elements.filter((x) => x.id !== sel.id); }); set({ elementActif: null }); }}>Supprimer</button>
          </div>
        </div>
      )}
    </div>
  );
}
