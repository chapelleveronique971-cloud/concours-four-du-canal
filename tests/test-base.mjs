// Teste 01_schema.sql dans un vrai Postgres local (PGlite) avec une imitation minimale de Supabase.
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';

const schema = fs.readFileSync(process.argv[2], 'utf8');
const db = new PGlite();
let ok = 0, ko = 0;
const t = (name, cond, extra = '') => { cond ? ok++ : ko++; console.log(`${cond ? 'OK ' : 'ÉCHEC'} ${name} ${extra}`); };

await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth, public to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
`);
await db.exec(schema);
const U = { g: '00000000-0000-0000-0000-00000000000a', e: '00000000-0000-0000-0000-00000000000b',
  j1: '00000000-0000-0000-0000-000000000001', j2: '00000000-0000-0000-0000-000000000002', j3: '00000000-0000-0000-0000-000000000003' };
await db.exec(`
  insert into auth.users values ('${U.g}','g'),('${U.e}','e'),('${U.j1}','j1'),('${U.j2}','j2'),('${U.j3}','j3');
  insert into public.profils values ('${U.g}','G','g','gerante'),('${U.e}','E','e','equipe'),
    ('${U.j1}','J1','j1','jure'),('${U.j2}','J2','j2','jure'),('${U.j3}','J3','j3','jure');
  insert into public.criteres (libelle, note_max, coefficient, ordre_affichage, ordre_departage) values
    ('Goût',10,2,1,1),('Aspect visuel',10,1,2,null),('Créativité',10,1,3,null);
`);

// Exécute une requête "en tant que" quelqu'un (anon ou utilisateur connecté)
async function as(who, sql, params = []) {
  const role = who === 'anon' ? 'anon' : 'authenticated';
  const sub = who === 'anon' ? '' : U[who];
  try {
    return await db.transaction(async (tx) => {
      await tx.exec(`set local role ${role}; select set_config('request.jwt.claim.sub', '${sub}', true);`);
      return { rows: (await tx.query(sql, params)).rows };
    });
  } catch (e) { return { error: e.message }; }
}
const ins = (o = {}) => {
  const d = { nom: 'Martin', prenom: 'Léa', email: 'lea@exemple.fr', tel: '', crea: 'Bûche', desc: '', all: 'Gluten, œufs',
    maj: true, reg: true, don: true, img: false, ...o };
  return as('anon', `select public.inscrire($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) as r`,
    [d.nom, d.prenom, d.email, d.tel, d.crea, d.desc, d.all, d.maj, d.reg, d.don, d.img]);
};

console.log('--- Niveau 1 : inscription ---');
let r = await ins();
t('inscription valide', !r.error, r.error || '');
t('nom vide refusé', (await ins({ nom: ' ', email: 'a@b.fr' })).error === 'CHAMP_MANQUANT:nom');
t('allergènes vides refusés', (await ins({ all: '', email: 'a@b.fr' })).error === 'CHAMP_MANQUANT:allergenes');
t('e-mail invalide refusé', (await ins({ email: 'lea@exemple' })).error === 'EMAIL_INVALIDE');
t('téléphone invalide refusé', (await ins({ email: 'x@y.fr', tel: '12ab' })).error === 'TELEPHONE_INVALIDE');
t('téléphone valide accepté', !(await ins({ email: 'tel@y.fr', tel: '06 12 34 56 78' })).error);
t('règlement non coché refusé', (await ins({ email: 'c@d.fr', reg: false })).error === 'CONSENTEMENT_MANQUANT:reglement');
t('majorité non attestée refusée', (await ins({ email: 'c@d.fr', maj: false })).error === 'CONSENTEMENT_MANQUANT:majeur');
t('doublon e-mail refusé (majuscules)', (await ins({ email: ' LEA@Exemple.FR ' })).error === 'DEJA_INSCRIT');
let n = (await db.query('select count(*)::int n from participants')).rows[0].n;
t('aucune inscription créée par les erreurs', n === 2, `(${n} inscrits)`);
t('anon ne lit pas la table participants', !!(await as('anon', 'select * from participants')).error);
t('places restantes = 18', (await as('anon', 'select public.places_restantes() p')).rows[0].p === 18);
for (let i = 3; i <= 20; i++) await ins({ email: `p${i}@exemple.fr`, crea: `Création ${i}` });
n = (await db.query('select count(*)::int n from participants')).rows[0].n;
t('20 inscrits atteints', n === 20);
t('21e inscription refusée : COMPLET', (await ins({ email: 'p21@exemple.fr' })).error === 'COMPLET');
t('doublon prioritaire sur complet', (await ins({ email: 'p5@exemple.fr' })).error === 'DEJA_INSCRIT');

console.log('--- Niveau 2 : droits et classement ---');
const ids = (await db.query('select id, dossard from participants order by dossard')).rows;
t('anon ne peut pas changer un statut', !!(await as('anon', `select public.changer_statut('${ids[0].id}','present')`)).error);
t('juré ne peut pas changer un statut', (await as('j1', `select public.changer_statut('${ids[0].id}','present')`)).error === 'ACCES_REFUSE');
t('équipe désiste un participant', !(await as('e', `select public.changer_statut('${ids[19].id}','desiste')`)).error);
t('désistement libère une place', !(await ins({ email: 'p21@exemple.fr', crea: 'Création 21' })).error);
for (const p of ids.slice(0, 3)) await as('e', `select public.changer_statut('${p.id}','present')`);
r = await as('j1', 'select * from participants');
t('juré : 0 ligne lue dans participants (coordonnées)', r.rows && r.rows.length === 0);
r = await as('j1', 'select * from public.creations_a_noter()');
t('juré voit 3 créations présentes', r.rows?.length === 3);
t('juré ne voit ni nom ni e-mail', r.rows && !('email' in r.rows[0]) && !('nom' in r.rows[0]));
t('équipe ne peut pas modifier un e-mail', ((await as('e', `update participants set email='z@z.fr' where id='${ids[0].id}' returning id`)).rows || []).length === 0);
t('équipe ne voit pas le classement', (await as('e', 'select * from public.classement()')).error === 'ACCES_REFUSE');
t('juré ne voit pas le classement', (await as('j1', 'select * from public.classement()')).error === 'ACCES_REFUSE');

const crit = (await db.query('select id, libelle from criteres order by ordre_affichage')).rows;
// Grille de test : [goût, aspect, créativité] par juré et par participant (dossards 1, 2, 3)
const grille = {
  j1: [[8, 7, 9], [9, 6, 7], [7, 8, 8]],
  j2: [[7, 8, 8], [8, 7, 6], [7, 9, 9]],
  j3: [[9, 6, 7], [8, 8, 8], [8, 7, 8]],
};
for (const [j, lignes] of Object.entries(grille))
  for (let p = 0; p < 3; p++)
    for (let c = 0; c < 3; c++) {
      const e = await as(j, `insert into notes (participant_id, critere_id, valeur) values ($1,$2,$3)`, [ids[p].id, crit[c].id, lignes[p][c]]);
      if (e.error) console.log('  erreur saisie', j, e.error);
    }
t('juré ne peut pas noter au nom d\'un autre', !!(await as('j1', `insert into notes (participant_id, jure_id, critere_id, valeur) values ($1,$2,$3,5)`, [ids[3].id, U.j2, crit[0].id])).error);
t('note > 10 refusée', !!(await as('j1', `insert into notes (participant_id, critere_id, valeur) values ($1,$2,11)`, [ids[3].id, crit[0].id])).error);
t('note < 0 refusée', !!(await as('j1', `insert into notes (participant_id, critere_id, valeur) values ($1,$2,-1)`, [ids[3].id, crit[0].id])).error);
r = await as('j1', 'select * from notes');
t('juré 1 ne lit que ses 9 notes', r.rows?.length === 9 && r.rows.every(x => x.jure_id === U.j1));
t('juré 2 ne modifie pas les notes du juré 1', ((await as('j2', `update notes set valeur=0 where jure_id='${U.j1}' returning id`)).rows || []).length === 0);
t('équipe ne lit aucune note', (await as('e', 'select * from notes')).rows?.length === 0);

// Calcul manuel indépendant
const manuel = [0, 1, 2].map(p => {
  const parJure = Object.values(grille).map(l => (l[p][0] * 2 + l[p][1] + l[p][2]) / 40 * 20);
  return { dossard: ids[p].dossard, finale: parJure.reduce((a, b) => a + b) / 3, gout: Object.values(grille).reduce((a, l) => a + l[p][0], 0) / 3 };
}).sort((a, b) => b.finale - a.finale || b.gout - a.gout);
r = await as('g', 'select * from public.classement() where rang is not null');
console.log('  calcul manuel :', manuel.map(m => `n°${m.dossard}=${m.finale.toFixed(2)} (goût ${m.gout.toFixed(2)})`).join(' · '));
console.log('  classement BD :', r.rows.map(x => `${x.rang}. n°${x.dossard}=${x.note_finale} (goût ${x.moyenne_departage})${x.ex_aequo ? ' ex æquo' : ''}`).join(' · '));
t('classement = calcul manuel (ordre et notes)', r.rows.length === 3 && r.rows.every((x, i) => x.dossard === manuel[i].dossard && Number(x.note_finale) === Math.round(manuel[i].finale * 100) / 100));
r = await as('g', 'select count(*)::int n from public.classement() where rang is null');
t('les autres apparaissent sans rang (notation incomplète)', r.rows[0].n === 17, `(${r.rows[0].n})`);

console.log(`\n${ok} réussis, ${ko} en échec`);
process.exit(ko ? 1 : 0);
