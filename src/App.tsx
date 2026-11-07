import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, type Mode } from "./etat/donnees";
import { Connexion } from "./ui/Connexion";
import { Accueil } from "./ui/Accueil";
import { Editeur } from "./ui/Editeur";
import { useEditeur } from "./etat/store";

export interface Contexte {
  mode: Mode;
  email: string | null;
  quitter: () => void;
}

export function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [local, setLocal] = useState(false);
  const projet = useEditeur((s) => s.projet);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (session === undefined) return <div className="connexion"><span className="logo">palmamotel</span></div>;
  if (!session && !local) return <Connexion onLocal={() => setLocal(true)} />;

  const ctx: Contexte = {
    mode: session ? "partage" : "local",
    email: session?.user.email ?? null,
    quitter: () => (session ? supabase.auth.signOut() : setLocal(false)),
  };
  return projet ? <Editeur ctx={ctx} /> : <Accueil ctx={ctx} />;
}
