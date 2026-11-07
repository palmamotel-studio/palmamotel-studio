-- =====================================================================
-- Palma Motel Studio — base de données Supabase
-- À coller UNE FOIS dans Supabase > SQL Editor > New query, puis « Run ».
-- Le script peut être relancé sans risque.
-- =====================================================================

-- 1) Membres autorisés (seules ces adresses peuvent se connecter et voir les données)
create table if not exists public.membres (
  email text primary key
);
insert into public.membres (email) values
  ('michel.palmamotel@gmail.com'),
  ('martin.palmamotel@gmail.com')
on conflict do nothing;

create or replace function public.est_membre() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.membres where email = lower(auth.jwt() ->> 'email'));
$$;

-- Bloque toute création de compte hors liste.
create or replace function public.verifier_inscription() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.membres where email = lower(new.email)) then
    raise exception 'Adresse non autorisée sur Palma Motel Studio';
  end if;
  return new;
end $$;
drop trigger if exists palma_verifier_inscription on auth.users;
create trigger palma_verifier_inscription before insert on auth.users
  for each row execute function public.verifier_inscription();

-- 2) Projets (un mock-up = un projet ; le contenu complet est en JSON)
create table if not exists public.projets (
  id uuid primary key default gen_random_uuid(),
  nom text not null default 'Sans nom',
  gabarit text not null,
  data jsonb not null,
  maj_le timestamptz not null default now(),
  maj_par text
);

-- 3) Palette de la marque
create table if not exists public.palette (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  pantone text,
  hex text not null,
  cree_le timestamptz not null default now()
);

-- 4) Bibliothèque de marque (étiquettes, patchs, logos…) — fichiers dans le stockage « marque »
create table if not exists public.bibliotheque (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  nom text not null,
  chemin text not null,
  meta jsonb not null default '{}',
  cree_le timestamptz not null default now()
);

-- Règles d'accès : uniquement les membres
alter table public.projets enable row level security;
alter table public.palette enable row level security;
alter table public.bibliotheque enable row level security;
alter table public.membres enable row level security;

do $$ begin
  drop policy if exists "membres projets" on public.projets;
  drop policy if exists "membres palette" on public.palette;
  drop policy if exists "membres bibliotheque" on public.bibliotheque;
  drop policy if exists "membres lecture" on public.membres;
end $$;
create policy "membres projets" on public.projets for all to authenticated using (public.est_membre()) with check (public.est_membre());
create policy "membres palette" on public.palette for all to authenticated using (public.est_membre()) with check (public.est_membre());
create policy "membres bibliotheque" on public.bibliotheque for all to authenticated using (public.est_membre()) with check (public.est_membre());
create policy "membres lecture" on public.membres for select to authenticated using (public.est_membre());

-- Synchronisation en direct
do $$ begin
  begin alter publication supabase_realtime add table public.projets; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.palette; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.bibliotheque; exception when duplicate_object then null; end;
end $$;

-- Stockage des fichiers de marque (privé)
insert into storage.buckets (id, name, public) values ('marque', 'marque', false) on conflict do nothing;
do $$ begin
  drop policy if exists "membres fichiers marque" on storage.objects;
end $$;
create policy "membres fichiers marque" on storage.objects for all to authenticated
  using (bucket_id = 'marque' and public.est_membre())
  with check (bucket_id = 'marque' and public.est_membre());
