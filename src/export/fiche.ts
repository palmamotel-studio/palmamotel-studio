import { jsPDF } from "jspdf";
import type { Projet } from "../etat/projet";
import { mesuresDe, rendreProjet, vuesDe, attendreRetouches, imagesDuRendu } from "../etat/calcul";
import { TAILLES, NOMS_VUES, VUES, type Vue } from "../moteur/types";
import { nomType } from "../moteur/elements";
import { compositeCanvas } from "./canvas";
import { precharger } from "../etat/visuels";

/**
 * FICHE TECHNIQUE (mini tech pack) en PDF, A4 paysage :
 * page 1 = vues annotées ; page 2 = mesures de toutes les tailles, matière, couleurs,
 * finitions, éléments posés, zones d'impression et notes.
 */
// Les polices standard du PDF ne couvrent pas tous les signes : on remplace les plus courants.
const txt = (s: string) => s.replace(/×/g, "x").replace(/[—–]/g, "-").replace(/Œ/g, "OE").replace(/œ/g, "oe").replace(/[«»]/g, '"').replace(/[^\x00-\xFF]/g, "");
const cm = (mm: number) => (Math.round(mm) / 10).toLocaleString("fr-FR");

const LIB_FIN: Record<string, string> = {
  piqure: "Surpiqûres", cotes: "Bords-côtes", bas: "Bas", bandeProprete: "Bande de propreté", cordon: "Cordons", embout: "Embouts", oeillet: "Œillets", zip: "Zip", couleurZip: "Couleur du zip",
};

export async function ficheTechnique(p: Projet): Promise<Uint8Array> {
  const { g } = mesuresDe(p, p.tailleRef);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = 297, H = 210, m = 12;
  const images = await precharger([...p.elements.map((e) => e.visuel).filter((v): v is string => !!v), ...(p.modele ? p.modele.vues.map((v) => "stockage:catalogue/" + v.chemin) : [])]);

  const entete = (titre: string) => {
    doc.setFillColor(20, 38, 42); doc.rect(0, 0, W, 18, "F");
    doc.setTextColor(255, 112, 150); doc.setFont("helvetica", "bolditalic"); doc.setFontSize(18); doc.text("palmamotel", m, 12);
    doc.setTextColor(230, 239, 237); doc.setFont("helvetica", "bold"); doc.setFontSize(10);
    doc.text(txt(`${titre}  ·  ${p.reference}  ·  ${p.nom}`), W - m, 8, { align: "right" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(8);
    doc.text(txt(`${g.nom} · ${p.cible} · coupe ${p.coupe} · taille de référence ${p.tailleRef}${p.collection ? " · " + p.collection : ""} · ${new Date().toLocaleDateString("fr-FR")}`), W - m, 13.5, { align: "right" });
    doc.setTextColor(20, 38, 42);
  };

  // ---------- Page 1 : vues ----------
  entete("FICHE TECHNIQUE");
  const vues: Vue[] = vuesDe(p);
  const largeurCase = (W - 2 * m - (vues.length - 1) * 6) / vues.length;
  for (const v of vues) await attendreRetouches(p, v, p.tailleRef);
  const rendus = vues.map((v) => rendreProjet(p, v, p.tailleRef, `pdf-${v}`));
  const imgs = images as Map<string, CanvasImageSource & { width: number; height: number }>;
  for (const r of rendus) await imagesDuRendu(r, imgs);
  // Même échelle pour toutes les vues, pour qu'elles restent comparables.
  const k = Math.min(...rendus.map((r) => Math.min(largeurCase / r.viewBox.l, 150 / r.viewBox.h)));
  vues.forEach((v, i) => {
    const r = rendus[i];
    const dpi = Math.min(110, 2400 / Math.max(r.viewBox.l, r.viewBox.h) * 25.4);
    const c = compositeCanvas(r, dpi, true, imgs);
    const l = r.viewBox.l * k, h = r.viewBox.h * k;
    const x = m + i * (largeurCase + 6) + (largeurCase - l) / 2;
    doc.addImage(c.toDataURL("image/jpeg", 0.9), "JPEG", x, 26, l, h);
    doc.setFont("helvetica", "bold"); doc.setFontSize(10);
    doc.text(txt(NOMS_VUES[v].toUpperCase()), m + i * (largeurCase + 6), 24);
    // Repères des éléments numérotés.
    p.elements.filter((e) => e.vue === v).forEach((e) => {
      const n = p.elements.indexOf(e) + 1;
      const ex = x + (e.x - r.viewBox.x) * k, ey = 26 + (e.y - r.viewBox.y) * k;
      doc.setFillColor(217, 70, 110); doc.circle(ex + (e.l * k) / 2 + 2.5, ey - (e.h * k) / 2 - 2.5, 2.2, "F");
      doc.setTextColor(255, 255, 255); doc.setFontSize(7); doc.text(String(n), ex + (e.l * k) / 2 + 2.5, ey - (e.h * k) / 2 - 1.6, { align: "center" });
      doc.setTextColor(20, 38, 42);
    });
  });
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(90, 109, 112);
  doc.text(txt("Dessins à l'échelle de la taille de référence. Couleurs écran approximatives : valider sur échantillon physique."), m, H - 8);
  doc.setTextColor(20, 38, 42);

  // ---------- Page 2 : spécifications ----------
  doc.addPage();
  entete("SPÉCIFICATIONS");
  let y = 26;
  const titre = (t: string, x: number, yy: number) => { doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(28, 122, 128); doc.text(txt(t.toUpperCase()), x, yy); doc.setTextColor(20, 38, 42); };

  // Tableau des mesures.
  titre("Mesures (cm, à plat)", m, y);
  y += 4;
  const colLib = 62, colT = 15;
  doc.setFont("helvetica", "bold"); doc.setFontSize(8);
  doc.text("Mesure", m, y + 3.5);
  TAILLES.forEach((t, i) => doc.text(t, m + colLib + i * colT + colT - 2, y + 3.5, { align: "right" }));
  y += 5;
  doc.setFont("helvetica", "normal");
  g.mesures.forEach((d, i) => {
    if (i % 2 === 0) { doc.setFillColor(241, 244, 243); doc.rect(m, y, colLib + 5 * colT, 4.6, "F"); }
    doc.text(txt(d.libelle), m + 1, y + 3.4);
    TAILLES.forEach((t, j) => {
      const v = mesuresDe(p, t).cm[d.cle];
      const saisie = p.tableau[t]?.[d.cle] !== undefined;
      doc.setFont("helvetica", saisie ? "bold" : "normal");
      doc.text(String(v).replace(".", ","), m + colLib + j * colT + colT - 2, y + 3.4, { align: "right" });
    });
    doc.setFont("helvetica", "normal");
    y += 4.6;
  });
  doc.setFontSize(7); doc.setTextColor(90, 109, 112);
  doc.text(txt("En gras : valeurs saisies. Autres valeurs : barème standard / gradation."), m, y + 4);
  doc.setTextColor(20, 38, 42);

  // Colonne de droite.
  const x2 = m + colLib + 5 * colT + 12, l2 = W - m - x2;
  let y2 = 26;
  const ligne = (lib: string, val: string) => {
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.text(txt(lib), x2, y2);
    doc.setFont("helvetica", "normal");
    const lignes = doc.splitTextToSize(txt(val || "-"), l2 - 40);
    doc.text(lignes, x2 + 40, y2);
    y2 += 4.2 * lignes.length + 0.8;
  };
  titre("Matière", x2, y2); y2 += 5;
  ligne("Type", p.matiere.type); ligne("Composition", p.matiere.composition); ligne("Grammage", p.matiere.grammage ? `${p.matiere.grammage} g/m²`.replace("²", "2") : ""); ligne("Effet", p.matiere.effet);
  y2 += 2; titre("Couleurs", x2, y2); y2 += 5;
  if (p.couleur.traitSeul) ligne("Couleur", "Trait seul (couleur non définie)");
  else {
    doc.setFillColor(p.couleur.principale); doc.rect(x2 + 40, y2 - 3, 8, 4, "F"); doc.setDrawColor(20, 38, 42); doc.rect(x2 + 40, y2 - 3, 8, 4);
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.text("Principale", x2, y2);
    doc.setFont("helvetica", "normal"); doc.text(txt(`${p.couleur.principale}${p.couleur.pantone ? " · Pantone " + p.couleur.pantone : ""}`), x2 + 51, y2); y2 += 5;
    if (p.couleur.cotes) ligne("Bords-côtes", p.couleur.cotes);
    if (p.couleur.interieur) ligne("Intérieur", p.couleur.interieur);
  }
  if (p.couleur.fil) ligne("Fil", p.couleur.fil);
  y2 += 2; titre("Finitions", x2, y2); y2 += 5;
  g.finitions.forEach((k) => {
    const v = p.finitions[k];
    ligne(LIB_FIN[k] ?? k, typeof v === "boolean" ? (v ? "oui" : "non") : String(v));
  });
  y2 += 2; titre("Éléments posés", x2, y2); y2 += 5;
  if (!p.elements.length) ligne("-", "Aucun");
  p.elements.forEach((e, i) => ligne(`${i + 1}. ${nomType(e.type)}`, `${e.matiere}, ${cm(e.l)} x ${cm(e.h)} cm, ${NOMS_VUES[e.vue].toLowerCase()}, centre à ${cm(Math.abs(e.x))} cm ${e.x < 0 ? "à gauche" : e.x > 0 ? "à droite" : ""} du milieu et ${cm(e.y)} cm sous le haut${e.texte ? ` · « ${e.texte} »` : ""}`));
  const zones = (g.vues ?? VUES).flatMap((v) => g.zones(mesuresDe(p, p.tailleRef).mm, v)).filter((z) => p.zonesActives.includes(z.id));
  if (zones.length) {
    y2 += 2; titre("Zones d'impression", x2, y2); y2 += 5;
    zones.forEach((z) => ligne(`${NOMS_VUES[z.vue]} · ${z.nom}`, `${cm(z.l)} x ${cm(z.h)} cm max, haut à ${cm(z.y)} cm`));
  }
  if (p.notes.trim()) {
    y2 += 2; titre("Notes", x2, y2); y2 += 5;
    doc.setFont("helvetica", "normal"); doc.setFontSize(8);
    const l = doc.splitTextToSize(txt(p.notes), l2);
    doc.text(l.slice(0, Math.max(1, Math.floor((H - 12 - y2) / 4))), x2, y2);
  }
  return new Uint8Array(doc.output("arraybuffer"));
}
