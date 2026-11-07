import { createClient, type Session } from "@supabase/supabase-js";
import type { Projet } from "./projet";
import { normaliser } from "./projet";

/**
 * Espace partagé (Supabase). La clé « publishable » est faite pour être publique :
 * l'accès aux données est protégé par les règles de la base (voir supabase/schema.sql).
 */
export const SUPABASE_URL = "https://viddwpcewwdqpmjjnltz.supabase.co";
const SUPABASE_CLE = "sb_publishable_HKTMcRTzQvUiua0f59TB-A_3dxAWZy8";
export const MEMBRES = ["michel.palmamotel@gmail.com", "martin.palmamotel@gmail.com"];

export const supabase = createClient(SUPABASE_URL, SUPABASE_CLE, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export type Mode = "partage" | "local";

export interface ResumeProjet {
  id: string;
  nom: string;
  gabarit: string;
  maj_le: string;
  maj_par: string | null;
  data: Projet;
}

export interface CouleurMarque {
  id: string;
  nom: string;
  pantone: string | null;
  hex: string;
}

export async function seConnecter(email: string): Promise<string | null> {
  const e = email.trim().toLowerCase();
  if (!MEMBRES.includes(e)) return "Cette adresse n'a pas accès au studio.";
  const { error } = await supabase.auth.signInWithOtp({
    email: e,
    options: { emailRedirectTo: window.location.origin + import.meta.env.BASE_URL },
  });
  if (error) return error.message.includes("rate") ? "Trop de demandes de lien : réessaie dans quelques minutes." : `Envoi impossible : ${error.message}`;
  return null;
}

export const seDeconnecter = () => supabase.auth.signOut();

export async function sessionActuelle(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/* ---------- Mode local (cet appareil uniquement) ---------- */
const CLE_LOCALE = "palma-studio-projets";
function lireLocal(): ResumeProjet[] {
  try { return JSON.parse(localStorage.getItem(CLE_LOCALE) || "[]"); } catch { return []; }
}
function ecrireLocal(l: ResumeProjet[]) {
  try { localStorage.setItem(CLE_LOCALE, JSON.stringify(l)); } catch { /* stockage plein ou bloqué */ }
}

/* ---------- Projets ---------- */
export async function listerProjets(mode: Mode): Promise<ResumeProjet[]> {
  if (mode === "local") return lireLocal().sort((a, b) => b.maj_le.localeCompare(a.maj_le));
  const { data, error } = await supabase.from("projets").select("id, nom, gabarit, maj_le, maj_par, data").order("maj_le", { ascending: false });
  if (error) throw error;
  return (data || []).map((r: any) => ({ ...r, data: normaliser(r.data) })).filter((r: any) => r.data) as ResumeProjet[];
}

export async function enregistrerProjet(mode: Mode, p: Projet, auteur: string | null): Promise<void> {
  const ligne: ResumeProjet = { id: p.id, nom: p.nom, gabarit: p.gabaritId, maj_le: new Date().toISOString(), maj_par: auteur, data: p };
  if (mode === "local") {
    const l = lireLocal().filter((x) => x.id !== p.id);
    ecrireLocal([ligne, ...l]);
    return;
  }
  const { error } = await supabase.from("projets").upsert(ligne);
  if (error) throw error;
}

export async function supprimerProjet(mode: Mode, id: string): Promise<void> {
  if (mode === "local") { ecrireLocal(lireLocal().filter((x) => x.id !== id)); return; }
  const { error } = await supabase.from("projets").delete().eq("id", id);
  if (error) throw error;
}

/** Écoute les changements faits par l'autre designer. Retourne la fonction pour arrêter. */
export function ecouterProjets(rappel: () => void): () => void {
  const canal = supabase
    .channel("projets")
    .on("postgres_changes", { event: "*", schema: "public", table: "projets" }, () => rappel())
    .subscribe();
  return () => { supabase.removeChannel(canal); };
}

/* ---------- Palette de marque ---------- */
export async function listerPalette(mode: Mode): Promise<CouleurMarque[]> {
  if (mode === "local") {
    try { return JSON.parse(localStorage.getItem("palma-studio-palette") || "[]"); } catch { return []; }
  }
  const { data, error } = await supabase.from("palette").select("id, nom, pantone, hex").order("cree_le");
  if (error) throw error;
  return data || [];
}

export async function ajouterCouleur(mode: Mode, c: Omit<CouleurMarque, "id">): Promise<void> {
  if (mode === "local") {
    const l = await listerPalette("local");
    try { localStorage.setItem("palma-studio-palette", JSON.stringify([...l, { ...c, id: crypto.randomUUID() }])); } catch { /* ignoré */ }
    return;
  }
  const { error } = await supabase.from("palette").insert(c);
  if (error) throw error;
}

export async function supprimerCouleur(mode: Mode, id: string): Promise<void> {
  if (mode === "local") {
    const l = await listerPalette("local");
    try { localStorage.setItem("palma-studio-palette", JSON.stringify(l.filter((x) => x.id !== id))); } catch { /* ignoré */ }
    return;
  }
  const { error } = await supabase.from("palette").delete().eq("id", id);
  if (error) throw error;
}
