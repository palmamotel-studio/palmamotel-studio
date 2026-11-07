// Supabase Edge Function « generer-mockup »
// Reçoit des dessins/photos et une description, demande à Claude de choisir la pièce
// du catalogue et de remplir la fiche, puis renvoie le résultat au studio.
// La clé Anthropic reste côté serveur (secret ANTHROPIC_API_KEY), jamais dans le site.
import Anthropic from "npm:@anthropic-ai/sdk@1.1.0";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (corps: unknown, status = 200) =>
  new Response(JSON.stringify(corps), { status, headers: { ...CORS, "Content-Type": "application/json" } });

interface PieceCatalogue {
  id: string;
  nom: string;
  mesures: { cle: string; libelle: string; defautM: number; min: number; max: number }[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ erreur: "Méthode non autorisée" }, 405);

  // 1) Seuls les membres de l'équipe peuvent l'utiliser.
  const auth = req.headers.get("Authorization") ?? "";
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: membre, error: errMembre } = await sb.rpc("est_membre");
  if (errMembre || membre !== true) return json({ erreur: "Accès réservé à l'équipe Palma Motel." }, 403);

  const cle = Deno.env.get("ANTHROPIC_API_KEY");
  if (!cle) return json({ erreur: "Clé ANTHROPIC_API_KEY absente des secrets Supabase." }, 500);

  // 2) Entrée : description, images (base64), catalogue des pièces disponibles.
  let corps: { description?: string; images?: { media_type: string; data: string }[]; catalogue?: PieceCatalogue[] };
  try { corps = await req.json(); } catch { return json({ erreur: "Requête illisible." }, 400); }
  const description = String(corps.description ?? "").slice(0, 6000);
  const images = (corps.images ?? []).slice(0, 4).filter((i) => /^image\/(jpeg|png|webp)$/.test(i.media_type));
  const catalogue = (corps.catalogue ?? []).slice(0, 80);
  if (!catalogue.length) return json({ erreur: "Catalogue manquant." }, 400);
  if (!description.trim() && !images.length) return json({ erreur: "Ajoute au moins un dessin ou une description." }, 400);

  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["gabaritId", "nom", "cible", "coupe", "tailleRef", "mesures", "couleur", "matiere", "zones", "notes", "ecarts"],
    properties: {
      gabaritId: { type: "string", enum: catalogue.map((c) => c.id) },
      nom: { type: "string" },
      cible: { type: "string", enum: ["unisexe", "homme", "femme", "enfant"] },
      coupe: { type: "string", enum: ["slim", "regular", "relaxed", "oversize", "boxy", "cropped"] },
      tailleRef: { type: "string", enum: ["XS", "S", "M", "L", "XL"] },
      mesures: {
        type: "array",
        items: { type: "object", additionalProperties: false, required: ["cle", "cm"], properties: { cle: { type: "string" }, cm: { type: "number" } } },
      },
      couleur: {
        type: "object", additionalProperties: false, required: ["traitSeul", "hex", "pantone"],
        properties: { traitSeul: { type: "boolean" }, hex: { type: "string" }, pantone: { type: "string" } },
      },
      matiere: {
        type: "object", additionalProperties: false, required: ["type", "composition", "grammage"],
        properties: { type: { type: "string" }, composition: { type: "string" }, grammage: { type: "integer" } },
      },
      zones: { type: "array", items: { type: "string" } },
      notes: { type: "string" },
      ecarts: { type: "string" },
    },
  };

  const systeme = `Tu prépares des mock-ups techniques (dessins à plat) pour Palma Motel, une marque de vêtements.
On te donne des dessins, photos ou une description d'une pièce. Tu choisis dans le catalogue la pièce la plus proche et tu remplis sa fiche.

Catalogue (id, nom, mesures disponibles avec valeur standard en taille M, en cm) :
${catalogue.map((c) => `- ${c.id} « ${c.nom} » : ${c.mesures.map((m) => `${m.cle} (${m.libelle}, M=${m.defautM}, ${m.min}–${m.max})`).join(" ; ")}`).join("\n")}

Règles :
- gabaritId : la pièce du catalogue la plus proche de ce qui est montré ou décrit.
- mesures : uniquement celles données explicitement (description, cotes écrites sur le dessin) ou déductibles sans doute possible. N'invente aucune mesure : une liste vide est normale. Utilise uniquement les clés de la pièce choisie, en cm, dans les bornes indiquées.
- tailleRef : la taille dont parlent les mesures (M si rien n'est précisé).
- couleur : traitSeul = true si aucune couleur n'est voulue ; sinon hex au format #RRGGBB et le code Pantone s'il est donné (sinon chaîne vide). Si une couleur est seulement nommée, donne un hex approchant et laisse pantone vide.
- matiere : type parmi jersey, interlock, french terry, fleece (molleton gratté), piqué, côte, nylon, denim, autre ; composition et grammage (g/m²) seulement s'ils sont donnés, sinon "" et 0.
- zones : identifiants de zones d'impression mentionnées ou visibles parmi coeur, centre, plein, bas, nuque, haut_dos, dos, poche, capuche, poitrine_droite.
- nom : un nom de modèle court si la description en donne un, sinon un nom descriptif (ex. « Hoodie zippé oversize »).
- notes : en français, les détails de confection et de marquage repérés (logos, broderies, étiquettes, coutures, matières) à garder dans la fiche.
- ecarts : en français, ce que le mock-up ne pourra pas reproduire avec la pièce choisie (détail absent du gabarit, autre type de vêtement…). Chaîne vide si rien.`;

  const contenu: Anthropic.Beta.BetaContentBlockParam[] = [
    ...images.map((i) => ({ type: "image" as const, source: { type: "base64" as const, media_type: i.media_type as "image/jpeg", data: i.data } })),
    { type: "text", text: description.trim() ? `Description : ${description}` : "Pas de description : base-toi sur les images." },
  ];

  const client = new Anthropic({ apiKey: cle });
  try {
    const rep = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: { type: "json_schema", schema } },
      system: systeme,
      messages: [{ role: "user", content: contenu }],
    } as any);
    if (rep.stop_reason === "refusal") return json({ erreur: "La demande a été refusée par le modèle. Reformule la description." }, 422);
    if (rep.stop_reason === "max_tokens") return json({ erreur: "Réponse trop longue, réessaie avec moins d'images." }, 422);
    const texte = rep.content.find((b: any) => b.type === "text") as { text: string } | undefined;
    if (!texte) return json({ erreur: "Réponse vide." }, 502);
    return json({ resultat: JSON.parse(texte.text) });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ erreur: "Trop de demandes : réessaie dans une minute." }, 429);
    if (e instanceof Anthropic.AuthenticationError) return json({ erreur: "Clé Anthropic invalide (secret ANTHROPIC_API_KEY)." }, 500);
    if (e instanceof Anthropic.APIError) return json({ erreur: `Erreur du service IA (${e.status}).` }, 502);
    return json({ erreur: "Erreur inattendue pendant la génération." }, 500);
  }
});
