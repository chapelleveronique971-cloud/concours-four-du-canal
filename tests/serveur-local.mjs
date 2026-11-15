// Serveur de TEST local (pas utilisé en production).
// Sert le dossier site/ et imite les appels « rpc » de Supabase avec un vrai
// Postgres en mémoire (PGlite) chargé avec supabase/01_schema.sql.
// Lancement : cd tests && npm install && node serveur-local.mjs   → http://localhost:8787
// Avec REEL=1, la page utilise le vrai Supabase de js/config.js (aucune imitation).
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PGlite } from '@electric-sql/pglite';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8787);
const db = new PGlite();
await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth; create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth, public to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;`);
await db.exec(fs.readFileSync(path.join(racine, 'supabase/01_schema.sql'), 'utf8'));
// Option : pré-remplir N inscrits pour tester la jauge (PREREMPLIR=19)
for (let i = 1; i <= Number(process.env.PREREMPLIR || 0); i++)
  await db.query(`select public.inscrire('Test${i}','Auto','auto${i}@exemple.fr','','Création ${i}','','aucun',true,true,true,false)`);

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' };

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.end();

  const rpc = url.pathname.match(/^\/rest\/v1\/rpc\/(\w+)$/);
  if (rpc) {
    let body = '';
    for await (const c of req) body += c;
    const args = body ? JSON.parse(body) : {};
    const noms = Object.keys(args);
    const sql = `select public.${rpc[1]}(${noms.map((n, i) => `${n} => $${i + 1}`).join(', ')}) as r`;
    try {
      const r = await db.transaction(async (tx) => {
        await tx.exec('set local role anon');
        return tx.query(sql, noms.map((n) => args[n]));
      });
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify(r.rows[0].r));
    } catch (e) {
      res.statusCode = 400; res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ code: 'P0001', message: e.message, details: null, hint: null }));
    }
  }

  let fichier = path.join(racine, 'site', decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
  if (!fichier.startsWith(path.join(racine, 'site')) || !fs.existsSync(fichier)) { res.statusCode = 404; return res.end('404'); }
  let contenu = fs.readFileSync(fichier);
  if (url.pathname === '/js/config.js' && !process.env.REEL) // branche la page sur ce serveur local, sans toucher au vrai fichier
    contenu = contenu.toString()
      .replace(/SUPABASE_URL = '[^']*'/, `SUPABASE_URL = 'http://localhost:${PORT}'`)
      .replace(/SUPABASE_ANON_KEY = '[^']*'/, `SUPABASE_ANON_KEY = 'cle-de-test-locale'`);
  res.setHeader('Content-Type', TYPES[path.extname(fichier)] || 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-store');
  res.end(contenu);
}).listen(PORT, () => console.log(`Serveur de test : http://localhost:${PORT}`));
