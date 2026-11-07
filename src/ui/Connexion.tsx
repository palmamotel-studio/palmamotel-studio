import { useState } from "react";
import { seConnecter } from "../etat/donnees";

export function Connexion({ onLocal }: { onLocal: () => void }) {
  const [email, setEmail] = useState("");
  const [etat, setEtat] = useState<"saisie" | "envoi" | "envoye">("saisie");
  const [erreur, setErreur] = useState<string | null>(null);

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setEtat("envoi");
    const err = await seConnecter(email);
    if (err) { setErreur(err); setEtat("saisie"); } else setEtat("envoye");
  }

  return (
    <main className="connexion">
      <form className="carte" onSubmit={envoyer}>
        <div>
          <div className="logo">palmamotel</div>
          <div className="eyebrow" style={{ marginTop: 6 }}>Studio de mock-ups</div>
        </div>
        {etat === "envoye" ? (
          <>
            <p>Un lien de connexion vient d'être envoyé à <b>{email}</b>. Ouvre l'e-mail sur cet appareil et touche le lien.</p>
            <button type="button" className="btn ghost" onClick={() => setEtat("saisie")}>Utiliser une autre adresse</button>
          </>
        ) : (
          <>
            <label className="champ">
              Ton adresse e-mail
              <input id="email" type="email" required autoComplete="email" placeholder="prenom.palmamotel@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            {erreur && <div className="erreur">{erreur}</div>}
            <button className="btn primary" disabled={etat === "envoi"}>{etat === "envoi" ? "Envoi…" : "Recevoir le lien de connexion"}</button>
            <p className="note">Pas de mot de passe : tu reçois un lien par e-mail. Seules les adresses de l'équipe ont accès.</p>
          </>
        )}
        <button type="button" className="btn ghost" onClick={onLocal}>Continuer sans connexion (cet appareil uniquement)</button>
      </form>
    </main>
  );
}
