-- =====================================================================
-- Fichier 2/2 : données de départ (critères + comptes de démonstration)
-- À exécuter APRÈS 01_schema.sql, dans Supabase > SQL Editor.
-- Comptes FICTIFS de démonstration (domaine .test, non joignable).
-- Mot de passe commun des comptes de démo : remplacer MOT_DE_PASSE_DEMO ci-dessous
-- par le mot de passe choisi AVANT d'exécuter ce fichier (il n'est pas publié ici).
-- =====================================================================

-- Critères et pondérations [H] (modifiables ensuite dans Table Editor > criteres)
insert into public.criteres (libelle, note_max, coefficient, ordre_affichage, ordre_departage)
select * from (values
  ('Goût', 10, 2, 1, 1),
  ('Aspect visuel', 10, 1, 2, null),
  ('Créativité et respect du thème', 10, 1, 3, null)
) v(libelle, note_max, coefficient, ordre_affichage, ordre_departage)
where not exists (select 1 from public.criteres);

-- Comptes de connexion de démonstration (gérante, équipe, 3 jurés)
do $$
declare
  r record;
  v_id uuid;
begin
  for r in select * from (values
    ('gerante@fourducanal.test', 'Gérante (démo)',  'gerante'),
    ('equipe@fourducanal.test',  'Équipe (démo)',   'equipe'),
    ('jure1@fourducanal.test',   'Juré 1 (démo)',   'jure'),
    ('jure2@fourducanal.test',   'Juré 2 (démo)',   'jure'),
    ('jure3@fourducanal.test',   'Juré 3 (démo)',   'jure')
  ) t(email, nom, role)
  loop
    select id into v_id from auth.users where email = r.email;
    if v_id is null then
      v_id := gen_random_uuid();
      insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change)
      values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
        r.email, extensions.crypt('MOT_DE_PASSE_DEMO', extensions.gen_salt('bf')),
        now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');
      insert into auth.identities (id, user_id, provider_id, identity_data, provider,
        last_sign_in_at, created_at, updated_at)
      values (gen_random_uuid(), v_id, v_id::text,
        json_build_object('sub', v_id::text, 'email', r.email, 'email_verified', true)::jsonb,
        'email', now(), now(), now());
    end if;
    insert into public.profils (id, nom, email, role) values (v_id, r.nom, r.email, r.role)
    on conflict (id) do update set nom = excluded.nom, role = excluded.role;
  end loop;
end $$;
