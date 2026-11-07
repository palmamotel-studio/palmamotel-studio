import { useState } from "react";
import { seConnecter, seConnecterMotDePasse } from "../etat/donnees";

export function Connexion({ onLocal }: { onLocal: () => void }) {
  const [mode, setMode] = useState<"mdp" | "lien">("mdp");
  const [email, setEmail] = useState("");
  const [mdp, setMdp] = useState("");
  const [etat, setEtat] = useState<"saisie" | "envoi" | "envoye">("saisie");
  const [erreur, setErreur] = useState<string | null>(null);

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setEtat("envoi");
    const err = mode === "mdp" ? await seConnecterMotDePasse(email, mdp) : await seConnecter(email);
    if (err) { setErreur(err); setEtat("saisie"); } else setEtat(mode === "lien" ? "envoye" : "saisie");
  }

  return (
    <main className="connexion">
      <form className="carte" onSubmit={envoyer}>
        <div>
          <div className="logo">palmamotel</div>
          <div className="eyebrow" style={{ marginTop: 6 }}>Studio de mock-ups</div>
        </div>
        <div className="seg" role="group" aria-label="Mode de connexion">
          <button type="button" aria-pressed={mode === "mdp"} onClick={() => { setMode("mdp"); setErreur(null); setEtat("saisie"); }}>Mot de passe</button>
          <button type="button" aria-pressed={mode === "lien"} onClick={() => { setMode("lien"); setErreur(null); }}>Lien par e-mail</button>
        </div>
        {etat === "envoye" ? (
          <>
            <p>Un lien de connexion vient d'être envoyé à <b>{email}</b>. Ouvre l'e-mail sur cet appareil et touche le lien. Une fois connecté, choisis un mot de passe (bouton « Mot de passe » en haut de l'accueil).</p>
            <button type="button" className="btn ghost" onClick={() => setEtat("saisie")}>Utiliser une autre adresse</button>
          </>
        ) : (
          <>
            <label className="champ">
              Ton adresse e-mail
              <input id="email" type="email" required autoComplete="username" placeholder="prenom.palmamotel@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            {mode === "mdp" && (
              <label className="champ">
                Mot de passe
                <input id="mdp" type="password" required autoComplete="current-password" value={mdp} onChange={(e) => setMdp(e.target.value)} />
              </label>
            )}
            {erreur && <div className="erreur">{erreur}</div>}
            <button className="btn primary" disabled={etat === "envoi"}>{etat === "envoi" ? "Connexion…" : mode === "mdp" ? "Se connecter" : "Recevoir le lien de connexion"}</button>
            <p className="note">{mode === "mdp" ? "Pas encore de mot de passe ? Utilise une fois le lien par e-mail, puis crée ton mot de passe depuis l'accueil." : "Le service d'e-mails gratuit n'envoie que quelques liens par heure : préfère le mot de passe dès qu'il est créé."}</p>
          </>
        )}
        <button type="button" className="btn ghost" onClick={onLocal}>Continuer sans connexion (cet appareil uniquement)</button>
      </form>
    </main>
  );
}
