-- =====================================================================
-- Le Four du Canal — Concours amateur de pâtisserie (prototype niveau 2)
-- Fichier 1/2 : tables, règles d'accès (RLS) et fonctions.
-- À exécuter une seule fois dans Supabase > SQL Editor.
-- Référence : CADRAGE.md (modèle de données + matrice des droits).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Paramètres fixes du concours (V1 : un seul concours, cf. CADRAGE)
-- ---------------------------------------------------------------------
create or replace function public.jauge_max() returns int
language sql immutable as $$ select 20 $$;               -- [H] 20 participants

-- ---------------------------------------------------------------------
-- UTILISATEUR (profil lié au compte de connexion Supabase)
-- ---------------------------------------------------------------------
create table if not exists public.profils (
  id    uuid primary key references auth.users(id) on delete cascade,
  nom   text not null,
  email text not null,
  role  text not null check (role in ('gerante', 'equipe', 'jure'))
);

-- Rôle de la personne connectée (null si non connectée ou sans profil)
create or replace function public.mon_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profils where id = auth.uid()
$$;

-- ---------------------------------------------------------------------
-- PARTICIPANT
-- ---------------------------------------------------------------------
create table if not exists public.participants (
  id               uuid primary key default gen_random_uuid(),
  dossard          int generated always as identity,  -- n° anonyme vu par les jurés
  nom              text not null check (char_length(nom) between 1 and 80),
  prenom           text not null check (char_length(prenom) between 1 and 80),
  email            text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$'),
  telephone        text,
  nom_creation     text not null check (char_length(nom_creation) between 1 and 120),
  description      text check (char_length(description) <= 600),
  allergenes       text not null check (char_length(allergenes) between 1 and 300),
  majeur_atteste   boolean not null check (majeur_atteste),
  consent_reglement boolean not null check (consent_reglement),
  consent_donnees  boolean not null check (consent_donnees),
  consent_image    boolean not null default false,
  statut           text not null default 'inscrit'
                   check (statut in ('inscrit', 'present', 'desiste')),
  date_inscription timestamptz not null default now()
);
-- Doublons : un e-mail ne peut être inscrit qu'une fois (majuscules ignorées)
create unique index if not exists participants_email_unique
  on public.participants (lower(email));

-- ---------------------------------------------------------------------
-- CRITERE
-- ---------------------------------------------------------------------
create table if not exists public.criteres (
  id              uuid primary key default gen_random_uuid(),
  libelle         text not null,
  note_max        int  not null default 10 check (note_max > 0),
  coefficient     int  not null check (coefficient > 0),
  ordre_affichage int  not null,
  ordre_departage int           -- 1 = premier critère de départage (Goût)
);

-- ---------------------------------------------------------------------
-- NOTE (une ligne par participant × juré × critère)
-- ---------------------------------------------------------------------
create table if not exists public.notes (
  id             uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete cascade,
  jure_id        uuid not null default auth.uid() references public.profils(id) on delete cascade,
  critere_id     uuid not null references public.criteres(id) on delete cascade,
  valeur         int  not null check (valeur >= 0),
  saisie_le      timestamptz not null default now(),
  unique (participant_id, jure_id, critere_id)
);

-- La note ne peut pas dépasser le maximum du critère
create or replace function public.verifier_note() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.valeur > (select note_max from public.criteres where id = new.critere_id) then
    raise exception 'NOTE_TROP_HAUTE';
  end if;
  new.saisie_le := now();
  return new;
end $$;
drop trigger if exists notes_verifier on public.notes;
create trigger notes_verifier before insert or update on public.notes
  for each row execute function public.verifier_note();

-- =====================================================================
-- RÈGLES D'ACCÈS (Row Level Security) — matrice des droits du CADRAGE
-- Par défaut, tout est refusé ; seules les règles ci-dessous ouvrent l'accès.
-- =====================================================================
alter table public.profils      enable row level security;
alter table public.participants enable row level security;
alter table public.criteres     enable row level security;
alter table public.notes        enable row level security;

-- Profils : chacun lit le sien ; la gérante lit tous les profils
drop policy if exists profils_lecture on public.profils;
create policy profils_lecture on public.profils for select to authenticated
  using (id = auth.uid() or public.mon_role() = 'gerante');

-- Participants (coordonnées incluses) : gérante et équipe lisent ;
-- seule la gérante modifie ou supprime. Les jurés n'ont AUCUN accès direct.
-- L'équipe change le statut via la fonction changer_statut().
-- Personne n'insère directement : l'inscription passe par inscrire().
drop policy if exists participants_lecture on public.participants;
create policy participants_lecture on public.participants for select to authenticated
  using (public.mon_role() in ('gerante', 'equipe'));
drop policy if exists participants_modif on public.participants;
create policy participants_modif on public.participants for update to authenticated
  using (public.mon_role() = 'gerante') with check (public.mon_role() = 'gerante');
drop policy if exists participants_suppr on public.participants;
create policy participants_suppr on public.participants for delete to authenticated
  using (public.mon_role() = 'gerante');

-- Critères : lus par toute l'équipe connectée ; modifiés par la gérante
drop policy if exists criteres_lecture on public.criteres;
create policy criteres_lecture on public.criteres for select to authenticated
  using (public.mon_role() is not null);
drop policy if exists criteres_modif on public.criteres;
create policy criteres_modif on public.criteres for update to authenticated
  using (public.mon_role() = 'gerante') with check (public.mon_role() = 'gerante');

-- Notes : le juré lit / crée / modifie SES notes uniquement ;
-- la gérante lit, modifie, supprime toutes les notes ; l'équipe : aucun accès.
drop policy if exists notes_lecture on public.notes;
create policy notes_lecture on public.notes for select to authenticated
  using ((public.mon_role() = 'jure' and jure_id = auth.uid())
         or public.mon_role() = 'gerante');
drop policy if exists notes_creation on public.notes;
create policy notes_creation on public.notes for insert to authenticated
  with check (public.mon_role() = 'jure' and jure_id = auth.uid());
drop policy if exists notes_modif on public.notes;
create policy notes_modif on public.notes for update to authenticated
  using ((public.mon_role() = 'jure' and jure_id = auth.uid()) or public.mon_role() = 'gerante')
  with check ((public.mon_role() = 'jure' and jure_id = auth.uid()) or public.mon_role() = 'gerante');
drop policy if exists notes_suppr on public.notes;
create policy notes_suppr on public.notes for delete to authenticated
  using (public.mon_role() = 'gerante');

-- Droits de base des rôles Supabase (le RLS ci-dessus filtre ensuite les lignes)
revoke all on public.profils, public.participants, public.criteres, public.notes from anon;
grant select on public.profils to authenticated;
grant select, update, delete on public.participants to authenticated;
grant select, update on public.criteres to authenticated;
grant select, insert, update, delete on public.notes to authenticated;

-- =====================================================================
-- FONCTIONS APPELÉES PAR LES PAGES
-- =====================================================================

-- Places restantes (affichées sur la page publique). Un désistement libère une place.
create or replace function public.places_restantes() returns int
language sql stable security definer set search_path = public as $$
  select greatest(public.jauge_max() - count(*)::int, 0)
  from public.participants where statut <> 'desiste'
$$;

-- Inscription publique : toutes les vérifications sont refaites ici, côté serveur.
-- Erreurs renvoyées (codes lus par la page) :
--   CHAMP_MANQUANT:<champ> · CHAMP_TROP_LONG:<champ> · EMAIL_INVALIDE · TELEPHONE_INVALIDE
--   CONSENTEMENT_MANQUANT:<champ> · DEJA_INSCRIT · COMPLET
create or replace function public.inscrire(
  p_nom text, p_prenom text, p_email text, p_telephone text,
  p_nom_creation text, p_description text, p_allergenes text,
  p_majeur boolean, p_reglement boolean, p_donnees boolean, p_image boolean
) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_tel   text := nullif(trim(coalesce(p_telephone, '')), '');
  v_id    uuid;
  v_dossard int;
begin
  if trim(coalesce(p_nom, '')) = ''          then raise exception 'CHAMP_MANQUANT:nom'; end if;
  if trim(coalesce(p_prenom, '')) = ''       then raise exception 'CHAMP_MANQUANT:prenom'; end if;
  if v_email = ''                            then raise exception 'CHAMP_MANQUANT:email'; end if;
  if trim(coalesce(p_nom_creation, '')) = '' then raise exception 'CHAMP_MANQUANT:nom_creation'; end if;
  if trim(coalesce(p_allergenes, '')) = ''   then raise exception 'CHAMP_MANQUANT:allergenes'; end if;
  if char_length(trim(p_nom)) > 80           then raise exception 'CHAMP_TROP_LONG:nom'; end if;
  if char_length(trim(p_prenom)) > 80        then raise exception 'CHAMP_TROP_LONG:prenom'; end if;
  if char_length(trim(p_nom_creation)) > 120 then raise exception 'CHAMP_TROP_LONG:nom_creation'; end if;
  if char_length(coalesce(p_description, '')) > 600 then raise exception 'CHAMP_TROP_LONG:description'; end if;
  if char_length(trim(p_allergenes)) > 300   then raise exception 'CHAMP_TROP_LONG:allergenes'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$' then raise exception 'EMAIL_INVALIDE'; end if;
  if v_tel is not null and (v_tel !~ '^\+?[0-9 .()-]+$'
     or char_length(regexp_replace(v_tel, '[^0-9]', '', 'g')) not between 10 and 15) then
    raise exception 'TELEPHONE_INVALIDE';
  end if;
  if not coalesce(p_majeur, false)    then raise exception 'CONSENTEMENT_MANQUANT:majeur'; end if;
  if not coalesce(p_reglement, false) then raise exception 'CONSENTEMENT_MANQUANT:reglement'; end if;
  if not coalesce(p_donnees, false)   then raise exception 'CONSENTEMENT_MANQUANT:donnees'; end if;

  -- Verrou : deux inscriptions simultanées ne peuvent pas dépasser la jauge
  lock table public.participants in share row exclusive mode;

  if exists (select 1 from public.participants where lower(email) = v_email) then
    raise exception 'DEJA_INSCRIT';
  end if;
  if public.places_restantes() <= 0 then
    raise exception 'COMPLET';
  end if;

  insert into public.participants (nom, prenom, email, telephone, nom_creation, description,
    allergenes, majeur_atteste, consent_reglement, consent_donnees, consent_image)
  values (trim(p_nom), trim(p_prenom), v_email, v_tel, trim(p_nom_creation),
    nullif(trim(coalesce(p_description, '')), ''), trim(p_allergenes),
    true, true, true, coalesce(p_image, false))
  returning id, dossard into v_id, v_dossard;

  return json_build_object('ok', true);
end $$;

-- Changement de statut (inscrit / présent / désisté) : gérante et équipe
create or replace function public.changer_statut(p_id uuid, p_statut text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.mon_role() not in ('gerante', 'equipe') or public.mon_role() is null then
    raise exception 'ACCES_REFUSE';
  end if;
  if p_statut not in ('inscrit', 'present', 'desiste') then
    raise exception 'STATUT_INVALIDE';
  end if;
  update public.participants set statut = p_statut where id = p_id;
end $$;

-- Créations à noter, vues par les jurés : SANS nom ni coordonnées.
-- Seuls les participants pointés « présents » sont proposés à la notation.
create or replace function public.creations_a_noter()
returns table (participant_id uuid, dossard int, nom_creation text, description text, allergenes text)
language plpgsql stable security definer set search_path = public as $$
begin
  if public.mon_role() is null then raise exception 'ACCES_REFUSE'; end if;
  return query
    select p.id, p.dossard, p.nom_creation, p.description, p.allergenes
    from public.participants p where p.statut = 'present' order by p.dossard;
end $$;

-- Classement (gérante uniquement), calculé à la demande, jamais stocké.
-- Note d'un juré = somme(note × coef) / somme(note_max × coef) × 20
-- Note finale    = moyenne des notes des jurés (seulement si TOUS les jurés ont tout noté)
-- Départage      = moyenne du critère ordre_departage = 1 (Goût), puis décision du jury
create or replace function public.classement()
returns table (participant_id uuid, dossard int, nom text, prenom text, nom_creation text,
               statut text, jures_complets int, jures_total int,
               note_finale numeric, moyenne_departage numeric, rang int, ex_aequo boolean)
language plpgsql stable security definer set search_path = public as $$
declare
  v_nb_criteres int := (select count(*) from public.criteres);
  v_nb_jures    int := (select count(*) from public.profils where role = 'jure');
begin
  if public.mon_role() is distinct from 'gerante' then raise exception 'ACCES_REFUSE'; end if;
  return query
  with par_jure as (
    select n.participant_id, n.jure_id,
           count(*) as nb,
           sum(n.valeur * c.coefficient)::numeric / sum(c.note_max * c.coefficient) * 20 as note_jure,
           max(case when c.ordre_departage = 1 then n.valeur end) as dep
    from public.notes n join public.criteres c on c.id = n.critere_id
    join public.profils pr on pr.id = n.jure_id and pr.role = 'jure'
    group by n.participant_id, n.jure_id
  ), complets as (
    select pj.participant_id, count(*)::int as nbj,
           avg(pj.note_jure) as finale, avg(pj.dep)::numeric as dep
    from par_jure pj where pj.nb = v_nb_criteres
    group by pj.participant_id
  ), base as (
    select p.id, p.dossard, p.nom, p.prenom, p.nom_creation, p.statut,
           coalesce(c.nbj, 0) as nbj,
           case when c.nbj = v_nb_jures and v_nb_jures > 0 then c.finale end as finale,
           case when c.nbj = v_nb_jures and v_nb_jures > 0 then c.dep end as dep
    from public.participants p left join complets c on c.participant_id = p.id
    where p.statut <> 'desiste' or c.nbj is not null
  )
  select b.id, b.dossard, b.nom, b.prenom, b.nom_creation, b.statut, b.nbj, v_nb_jures,
         round(b.finale, 2), round(b.dep, 2),
         case when b.finale is not null then
           (rank() over (partition by (b.finale is null) order by b.finale desc, b.dep desc))::int end,
         case when b.finale is not null then
           count(*) over (partition by b.finale, b.dep) > 1 else false end
  from base b
  order by b.finale desc nulls last, b.dep desc nulls last, b.dossard;
end $$;

-- Qui peut appeler quoi
revoke all on function public.inscrire(text,text,text,text,text,text,text,boolean,boolean,boolean,boolean) from public;
grant execute on function public.inscrire(text,text,text,text,text,text,text,boolean,boolean,boolean,boolean) to anon, authenticated;
grant execute on function public.places_restantes() to anon, authenticated;
revoke all on function public.changer_statut(uuid, text) from public, anon;
grant execute on function public.changer_statut(uuid, text) to authenticated;
revoke all on function public.creations_a_noter() from public, anon;
grant execute on function public.creations_a_noter() to authenticated;
revoke all on function public.classement() from public, anon;
grant execute on function public.classement() to authenticated;
