import { create } from "zustand";
import { supabase } from "./donnees";

/**
 * Visuels importés (logos, fichiers d'étiquettes, patchs).
 * Espace partagé : fichier dans le stockage privé « marque », référencé « stockage:chemin ».
 * Mode local : le visuel est gardé directement dans le projet (« data:… »).
 */
const cache = new Map<string, string>(); // src → data URL
const enCours = new Set<string>();
export const useVisuels = create<{ version: number }>(() => ({ version: 0 }));

function lireDataUrl(b: Blob): Promise<string> {
  return new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => ko(r.error); r.readAsDataURL(b); });
}

/** URL affichable d'un visuel ; lance son chargement si besoin (l'aperçu se redessine ensuite). */
export function urlVisuel(src: string): string | null {
  if (src.startsWith("data:")) return src;
  const ok = cache.get(src);
  if (ok) return ok;
  if (src.startsWith("stockage:") && !enCours.has(src)) {
    enCours.add(src);
    supabase.storage.from("marque").download(src.slice(9)).then(async ({ data }) => {
      if (data) { cache.set(src, await lireDataUrl(data)); useVisuels.setState((s) => ({ version: s.version + 1 })); }
      enCours.delete(src);
    });
  }
  return null;
}

/** Charge tous les visuels nécessaires (avant un export). */
export async function precharger(srcs: string[]): Promise<Map<string, HTMLImageElement>> {
  const out = new Map<string, HTMLImageElement>();
  for (const src of new Set(srcs)) {
    let url = urlVisuel(src);
    if (!url && src.startsWith("stockage:")) {
      const { data } = await supabase.storage.from("marque").download(src.slice(9));
      if (data) { url = await lireDataUrl(data); cache.set(src, url); }
    }
    if (!url) continue;
    const img = new Image();
    await new Promise<void>((ok) => { img.onload = () => ok(); img.onerror = () => ok(); img.src = url!; });
    if (img.naturalWidth) out.set(src, img);
  }
  return out;
}

/** Importe un fichier image (PNG/JPG/SVG) et renvoie sa référence. */
export async function importerVisuel(f: File, partage: boolean): Promise<string> {
  // Les SVG sont convertis en PNG (rendu identique écran / export, pas de script).
  let blob: Blob = f;
  if (f.type === "image/svg+xml" || f.size > 1.5e6) {
    const url = URL.createObjectURL(f);
    const img = new Image();
    await new Promise<void>((ok, ko) => { img.onload = () => ok(); img.onerror = () => ko(new Error("Image illisible")); img.src = url; });
    const k = Math.min(1, 2400 / Math.max(img.naturalWidth || 1200, img.naturalHeight || 1200));
    const c = document.createElement("canvas");
    c.width = Math.round((img.naturalWidth || 1200) * k); c.height = Math.round((img.naturalHeight || 1200) * k);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(url);
    blob = await new Promise<Blob>((ok) => c.toBlob((b) => ok(b!), "image/png"));
  }
  const data = await lireDataUrl(blob);
  if (!partage) return data;
  const chemin = `visuels/${crypto.randomUUID()}.${blob.type === "image/jpeg" ? "jpg" : "png"}`;
  const { error } = await supabase.storage.from("marque").upload(chemin, blob, { contentType: blob.type || "image/png" });
  if (error) throw new Error("Envoi du fichier impossible : " + error.message);
  cache.set("stockage:" + chemin, data);
  return "stockage:" + chemin;
}
