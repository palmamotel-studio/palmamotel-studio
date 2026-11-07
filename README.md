# Palma Motel Studio

Studio de mock-ups de vêtements de la marque Palma Motel : dessins techniques à plat, calculés à partir des vraies mesures, exportés à l'échelle réelle vers Procreate, Canva et l'impression.

Adresse : **https://palmamotel-studio.github.io/palmamotel-studio/**

## Utiliser l'outil

1. Ouvre l'adresse sur Mac, Chromebook ou iPad. Sur iPad, dans Safari, utilise **Partager → Sur l'écran d'accueil** pour l'installer comme une application.
2. Connecte-toi avec ton adresse (lien reçu par e-mail). Seules les adresses de l'équipe ont accès.
3. Choisis une pièce, puis suis les 7 étapes : Pièce → Tailles & mesures → Matière & couleur → Finitions → Éléments → Retouches → Export.
4. Tout est enregistré automatiquement et partagé entre vous deux.

## Ce que fait l'outil

- **31 pièces** : T-shirt, manches longues, polo, débardeur, sweat col rond, hoodie, hoodie zippé ; 10 vestes (cagoule zippée, coach, bomber, varsity, coupe-vent, harrington, jean, track, doudoune, softshell) ; jogging, short, pantalon droit, cargo ; short de bain, bikini haut et bas ; casquette, bob, bonnet, tote bag, chaussettes.
- **Vues** : face, dos, profil (hauts à manches longues et vestes), zooms de détail (col, poignet, poche, étiquette).
- **Tailles XS à XL** avec gradation, mesures guidées avec cotes sur le dessin, score de précision.
- **Finitions** (surpiqûres, côtes, bas, cordons, embouts, œillets, zips), **effets matière**, plis selon le grammage.
- **Éléments** : étiquettes, hang tag, patchs, boutons, pressions, œillets ; import de vos visuels ; bibliothèque de marque partagée.
- **Export** : PSD en calques (dossier Éléments, Lumières, Ombres et plis, TON DESIGN ICI, REPÈRES), PNG, PNG par calque, SVG, carte de déplacement, détails, fiche technique PDF, projet .json ; par lot de coloris et de tailles.
- **Comparaison** de deux mock-ups, générateur à partir de dessins, espace partagé.

## Catalogue de modèles (pack Opus)

Les 681 planches du pack Opus sont découpées en 2 729 vues et rangées par famille et catégorie (hauts, vestes, bas, accessoires, nouveautés). Elles sont stockées **dans l'espace privé Supabase** (`marque/catalogue/`, index `catalogue/index.json`), jamais dans ce dépôt public, conformément à la licence du pack.

Un mock-up créé depuis un modèle utilise l'image comme dessin : couleur (calque « Produit »), éléments, retouches et exports fonctionnent comme pour les pièces dessinées. L'échelle se règle à l'étape « Vues & échelle » (largeur réelle de la vue de face).

## Générateur à partir de dessins

Sur l'accueil, « Générer à partir de dessins » : dépose jusqu'à 4 dessins ou photos et/ou une description. Claude (modèle `claude-opus-5-5`) choisit la pièce du catalogue la plus proche, reprend les mesures données, la couleur, la matière, les zones d'impression et note les détails à reprendre à la main.

Installation (une fois) :
1. Clé API Anthropic : console.anthropic.com → API Keys (facturation à l'usage).
2. Supabase → Edge Functions → Secrets : ajouter `ANTHROPIC_API_KEY`.
3. Supabase → Edge Functions → Deploy a new function → Via Editor : nom `generer-mockup`, coller `supabase/functions/generer-mockup/index.ts`, Deploy.

La clé reste côté serveur ; la fonction vérifie que l'utilisateur est membre de l'équipe.

## Lancer en local (développeurs)

```bash
npm install
npm run dev      # http://localhost:5173/palmamotel-studio/
npm test         # tests du moteur (mesures → géométrie, échelle, gradation)
npm run build    # version de production dans dist/
```

Chaque envoi sur la branche `main` met le site à jour automatiquement (GitHub Actions → GitHub Pages).

## Organisation du code

```
src/moteur/     géométrie en millimètres, tailles et gradation, rendu en calques, échelle DPI, score de précision
src/gabarits/   un fichier par vêtement (tshirt.ts, hoodie.ts…) + index.ts (catalogue)
src/export/     PNG, PSD en calques, SVG, zip, partage iPad
src/etat/       projet, historique annuler/rétablir, espace partagé Supabase
src/ui/         écrans (connexion, accueil, éditeur, étapes)
supabase/       schema.sql : tables, règles d'accès, stockage
```

Règle d'or : **toute la géométrie est en millimètres**. Les pixels n'apparaissent qu'à l'export (`moteur/echelle.ts`).

## Ajouter un nouveau type de vêtement

1. Copie `src/gabarits/tshirt.ts` en `src/gabarits/mon-vetement.ts`.
2. Décris ses **mesures** (`mesures: [...]`) : clé, libellé, aide « où mesurer », niveau (obligatoire / recommandé / optionnel), valeur en M, gradation entre tailles, min/max, et la **cote** à dessiner pour montrer où mesurer.
3. Écris `dessiner(m, vue, pose)` : à partir des mesures en mm, renvoie les tracés dans l'ordre de superposition, chacun avec son rôle (`piece`, `cote`, `couture`, `surpiqure`, `pli`, `ombre`, `interieur`, `accessoire`). Le moteur s'occupe des couleurs, des calques, des masques et de l'export.
4. Écris `zones(m, vue)` (zones d'impression), `controles(m)` (alertes de cohérence) et `poignees(...)` (retouche directe).
5. Branche-le dans `src/gabarits/index.ts` : `gabarit: monVetement` sur sa ligne du catalogue.
6. Lance `npm test` : le test « tous les gabarits disponibles » vérifie automatiquement chaque taille, vue et pose.

Aucun autre fichier n'a besoin d'être modifié.

## Ajouter un élément à la bibliothèque

La bibliothèque d'éléments (étiquettes, patchs, cordons…) arrive en vague 2. Elle utilise déjà la table `bibliotheque` et le stockage privé `marque` de Supabase (voir `supabase/schema.sql`). Les éléments seront décrits comme les gabarits, un fichier par type, avec leurs dimensions réelles en mm.

## Espace partagé (Supabase)

- Projet : `viddwpcewwdqpmjjnltz` (région Europe).
- Le schéma se trouve dans `supabase/schema.sql`. Il se colle une fois dans Supabase > SQL Editor.
- Pour ajouter une personne : ajoute son e-mail dans la table `membres` et dans `MEMBRES` de `src/etat/donnees.ts`.
- La clé présente dans le code est la clé publique (« publishable »). Les données sont protégées par les règles d'accès de la base.

## Export et échelle

- Exports à l'échelle réelle : à 150 DPI, 1 cm = 59 px ; à 300 DPI, 1 cm = 118 px. La résolution est inscrite dans le PSD.
- Le calque « REPÈRES — à masquer » contient une règle de 10 cm et les zones d'impression avec leurs cotes.
- Ordre des calques PSD (de haut en bas) : REPÈRES, Retouches, Ombres et plis (Produit), Éléments, Coutures, Contours, TON DESIGN ICI — [zone], Couleur de base, Fond.
- Nommage : `[Référence]_[Modèle]_[Couleur]_[Vue]_[Taille]_[Date].ext`.
