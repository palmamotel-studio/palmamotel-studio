import { supabase } from "./donnees";
import { CATALOGUE, gabarit } from "../gabarits";
import { nouveauProjet, type Projet } from "./projet";
import { TAILLES, type Taille } from "../moteur/types";

export interface ResultatIA {
  gabaritId: string;
  nom: string;
  cible: Projet["cible"];
  coupe: Projet["coupe"];
  tailleRef: Taille;
  mesures: { cle: string; cm: number }[];
  couleur: { traitSeul: boolean; hex: string; pantone: string };
  matiere: { type: string; composition: string; grammage: number };
  zones: string[];
  notes: string;
  ecarts: string;
}

/** Réduit une image (max 1568 px, JPEG) et la passe en base64. */
export async function preparerImage(f: File): Promise<{ media_type: string; data: string; apercu: string }> {
  const url = URL.createObjectURL(f);
  try {
    const img = new Image();
    await new Promise<void>((ok, ko) => { img.onload = () => ok(); img.onerror = () => ko(new Error("Image illisible")); img.src = url; });
    const k = Math.min(1, 1568 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    const g = c.getContext("2d")!;
    g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
    g.drawImage(img, 0, 0, c.width, c.height);
    const apercu = c.toDataURL("image/jpeg", 0.85);
    return { media_type: "image/jpeg", data: apercu.split(",")[1], apercu };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Envoie dessins + description à la fonction serveur et récupère la fiche proposée. */
export async function generer(description: string, images: { media_type: string; data: string }[]): Promise<ResultatIA> {
  const catalogue = CATALOGUE.filter((c) => c.gabarit).map((c) => ({
    id: c.id,
    nom: c.nom,
    mesures: c.gabarit!.mesures.map((m) => ({ cle: m.cle, libelle: m.libelle, defautM: m.defautM, min: m.min, max: m.max })),
  }));
  const { data, error } = await supabase.functions.invoke("generer-mockup", { body: { description, images, catalogue } });
  if (error) {
    let msg = "Le générateur ne répond pas.";
    try { const corps = await (error as any).context?.json?.(); if (corps?.erreur) msg = corps.erreur; } catch { /* ignoré */ }
    if ((error as any).name === "FunctionsFetchError") msg = "Le générateur n'est pas encore installé sur Supabase (fonction « generer-mockup »).";
    throw new Error(msg);
  }
  if (!data?.resultat || !gabarit(data.resultat.gabaritId)) throw new Error(data?.erreur || "Réponse inattendue du générateur.");
  return data.resultat as ResultatIA;
}

/** Transforme la proposition en projet, en ne gardant que des valeurs valides. */
export function projetDepuisIA(r: ResultatIA, numero: number, description: string): Projet {
  const p = nouveauProjet(r.gabaritId, numero);
  const g = gabarit(r.gabaritId)!;
  if (r.nom?.trim()) p.nom = r.nom.trim().slice(0, 80);
  p.cible = r.cible; p.coupe = r.coupe;
  p.tailleRef = TAILLES.includes(r.tailleRef) ? r.tailleRef : "M";
  const saisies: Record<string, number> = {};
  for (const m of r.mesures || []) {
    const d = g.mesures.find((x) => x.cle === m.cle);
    if (d && Number.isFinite(m.cm) && m.cm >= d.min && m.cm <= d.max) saisies[d.cle] = Math.round(m.cm * 10) / 10;
  }
  if (Object.keys(saisies).length) p.tableau[p.tailleRef] = saisies;
  if (!r.couleur.traitSeul && /^#[0-9a-f]{6}$/i.test(r.couleur.hex)) {
    p.couleur.traitSeul = false;
    p.couleur.principale = r.couleur.hex.toUpperCase();
    p.couleur.pantone = r.couleur.pantone || "";
  }
  if (r.matiere.type) p.matiere.type = r.matiere.type;
  p.matiere.composition = r.matiere.composition || "";
  p.matiere.grammage = r.matiere.grammage > 0 ? r.matiere.grammage : null;
  const zonesDispo = new Set(["face", "dos"].flatMap((v) => g.zones({}, v as any).map((z) => z.id)));
  p.zonesActives = (r.zones || []).filter((z) => zonesDispo.has(z));
  p.notes = [r.notes, r.ecarts && `À reprendre à la main : ${r.ecarts}`, description && `Demande d'origine : ${description}`].filter(Boolean).join("\n\n");
  return p;
}
