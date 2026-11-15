// Espace organisation : connexion par rôle, participants, notation, classement, e-mails.
// Les droits sont appliqués par la BASE (règles RLS de supabase/01_schema.sql) ;
// cette page n'affiche que ce que la base accepte de renvoyer.
import { SUPABASE_URL, SUPABASE_ANON_KEY, supabaseConfigure } from './config.js';
import { emailConfirmation, emailRappel, blocApercu } from './emails.js';

const $ = (id) => document.getElementById(id);
const el = (tag, attrs = {}, ...enfants) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) n.setAttribute(k, v === true ? '' : v);
  }
  for (const e of enfants.flat()) if (e != null) n.append(e);
  return n;
};

const ROLES = { gerante: 'Gérante', equipe: 'Équipe', jure: 'Juré' };
const STATUTS = { inscrit: 'Inscrit', present: 'Présent', desiste: 'Désisté' };
const ONGLETS = {
  gerante: [['participants', 'Participants'], ['classement', 'Classement'], ['emails', 'E-mails'], ['criteres', 'Critères']],
  equipe: [['participants', 'Participants'], ['criteres', 'Critères']],
  jure: [['notation', 'Noter'], ['criteres', 'Critères']],
};

const etat = { user: null, role: null, nom: '', participants: [], criteres: [], ongletActif: null };
let sb = null;

// ---------------------------------------------------------------- utilitaires
function alerteApp(message, info = false) {
  const a = $('alerte-app');
  if (!message) { a.hidden = true; return; }
  a.className = info ? 'alerte alerte--info' : 'alerte';
  a.textContent = message;
  a.hidden = false;
}
function messageErreur(error) {
  const m = error?.message || '';
  if (m.includes('ACCES_REFUSE') || m.includes('permission denied') || error?.code === '42501')
    return 'Accès refusé : votre rôle ne permet pas cette action.';
  if (m.includes('NOTE_TROP_HAUTE')) return 'Une note dépasse le maximum autorisé (10).';
  if (m.includes('Failed to fetch') || m.includes('NetworkError')) return 'Problème de connexion internet : l’action n’a pas été enregistrée. Réessayez.';
  return 'L’action n’a pas pu être enregistrée (erreur technique). Réessayez.';
}
const dateFr = (iso) => new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const heureFr = () => new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

// ---------------------------------------------------------------- connexion
async function demarrer() {
  if (!supabaseConfigure()) {
    $('chargement').textContent = 'L’outil n’est pas encore branché à Supabase (voir js/config.js).';
    return;
  }
  // Une connexion PAR ONGLET (sessionStorage) : se connecter en juré dans un onglet
  // ne remplace plus la connexion de la gérante ouverte dans un autre onglet.
  // Identifiant propre à l'onglet (conservé s'il est rechargé) : la bibliothèque Supabase
  // synchronise les onglets qui partagent la même clé ; une clé par onglet les rend indépendants.
  let idOnglet = sessionStorage.getItem('four-du-canal-onglet');
  if (!idOnglet) {
    idOnglet = Math.random().toString(36).slice(2, 10);
    sessionStorage.setItem('four-du-canal-onglet', idOnglet);
  }
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { storage: window.sessionStorage, storageKey: `four-du-canal-outil-${idOnglet}` },
  });
  // Si la session de cet onglet se termine (expiration, déconnexion), on revient à l'écran de connexion
  sb.auth.onAuthStateChange((evenement) => {
    if (evenement === 'SIGNED_OUT' && etat.user) {
      location.replace(`${location.pathname}#deconnecte`);
      location.reload();
    }
  });
  const { data } = await sb.auth.getSession();
  if (data.session) await ouvrirSession(data.session.user);
  else if (location.hash === '#deconnecte') {
    afficherConnexion('Vous êtes déconnecté·e.');
    $('alerte-connexion').className = 'alerte alerte--info';
    history.replaceState(null, '', location.pathname);
  } else afficherConnexion();
}

function afficherConnexion(message) {
  $('chargement').hidden = true;
  $('vue-app').hidden = true;
  $('session').hidden = true;
  $('vue-connexion').hidden = false;
  const a = $('alerte-connexion');
  a.hidden = !message;
  if (message) a.textContent = message;
}

$('form-connexion').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('cx-email').value.trim();
  const mdp = $('cx-mdp').value;
  if (!email || !mdp) return afficherConnexion('Indiquez votre adresse e-mail et votre mot de passe.');
  const btn = $('btn-connexion');
  btn.disabled = true; btn.textContent = 'Connexion…';
  const { data, error } = await sb.auth.signInWithPassword({ email, password: mdp });
  btn.disabled = false; btn.textContent = 'Se connecter';
  if (error) {
    return afficherConnexion(error.message?.includes('Invalid login')
      ? 'Adresse e-mail ou mot de passe incorrect.' : 'Connexion impossible pour le moment. Vérifiez votre connexion internet.');
  }
  $('cx-mdp').value = '';
  await ouvrirSession(data.user);
});

$('btn-deconnexion').addEventListener('click', async () => {
  etat.user = null; // évite un double rechargement par onAuthStateChange
  await sb.auth.signOut({ scope: 'local' }); // déconnecte cet onglet seulement (comptes de démo partagés)
  // Rechargement complet : aucune donnée de la session précédente ne reste dans la page
  location.replace(`${location.pathname}#deconnecte`);
  location.reload();
});

async function ouvrirSession(user) {
  const { data: profil } = await sb.from('profils').select('nom, role').eq('id', user.id).maybeSingle();
  if (!profil) {
    await sb.auth.signOut();
    return afficherConnexion('Ce compte n’a aucun rôle dans le concours : accès refusé.');
  }
  Object.assign(etat, { user, role: profil.role, nom: profil.nom });
  $('chargement').hidden = true;
  $('vue-connexion').hidden = true;
  $('alerte-connexion').className = 'alerte';
  $('vue-app').hidden = false;
  $('session').hidden = false;
  $('badge-role').textContent = ROLES[profil.role];
  $('badge-role').dataset.role = profil.role;
  $('nom-utilisateur').textContent = profil.nom;

  // Critères chargés AVANT d'afficher les onglets (sinon un clic rapide pouvait être annulé)
  const { data: criteres } = await sb.from('criteres').select('*').order('ordre_affichage');
  etat.criteres = criteres || [];
  const nav = $('onglets');
  nav.innerHTML = '';
  for (const [id, libelle] of ONGLETS[profil.role]) {
    nav.append(el('button', { type: 'button', class: 'onglet', 'data-onglet': id, onclick: () => ouvrirOnglet(id) }, libelle));
  }
  ouvrirOnglet(ONGLETS[profil.role][0][0]);
}

function ouvrirOnglet(id) {
  etat.ongletActif = id;
  alerteApp(null);
  document.querySelectorAll('.onglet').forEach((b) => b.setAttribute('aria-current', b.dataset.onglet === id ? 'page' : 'false'));
  document.querySelectorAll('.panneau').forEach((p) => { p.hidden = p.id !== `panneau-${id}`; });
  ({ participants: chargerParticipants, notation: chargerNotation, classement: chargerClassement,
    emails: chargerEmails, criteres: afficherCriteres })[id]();
}

// ---------------------------------------------------------------- critères
function afficherCriteres() {
  const tb = $('tbody-criteres');
  tb.innerHTML = '';
  for (const c of etat.criteres) {
    tb.append(el('tr', {}, el('th', { scope: 'row', text: c.libelle }), el('td', { text: `sur ${c.note_max}` }),
      el('td', { text: `× ${c.coefficient}` }), el('td', { text: c.ordre_departage ? `${c.ordre_departage}er critère` : '—' })));
  }
  $('aide-criteres').textContent = etat.role === 'gerante'
    ? 'Pour modifier un critère ou un coefficient : Supabase > Table Editor > criteres (pas d’écran de modification dans le prototype).'
    : 'Critères fixés par la gérante.';
}

// ---------------------------------------------------------------- participants
async function chargerParticipants() {
  const { data, error } = await sb.from('participants').select('*').order('dossard');
  if (error) { alerteApp(messageErreur(error)); return; }
  etat.participants = data;
  afficherParticipants();
}

function afficherParticipants() {
  const tous = etat.participants;
  const n = (s) => tous.filter((p) => p.statut === s).length;
  const actifs = tous.length - n('desiste');
  $('compteurs').innerHTML = '';
  for (const [libelle, valeur] of [['Inscrits actifs', `${actifs} / 20`], ['Présents', n('present')], ['Désistés', n('desiste')], ['Places restantes', Math.max(20 - actifs, 0)]])
    $('compteurs').append(el('div', { class: 'compteur' }, el('span', { class: 'compteur__valeur', text: String(valeur) }), el('span', { text: libelle })));

  const q = $('recherche').value.trim().toLowerCase();
  const f = $('filtre-statut').value;
  const liste = tous.filter((p) => (!f || p.statut === f) && (!q || [p.nom, p.prenom, p.email, p.nom_creation, String(p.dossard)].join(' ').toLowerCase().includes(q)));

  const zone = $('liste-participants');
  zone.innerHTML = '';
  if (!tous.length) { zone.append(el('p', { class: 'vide', text: 'Aucune inscription pour le moment.' })); return; }
  if (!liste.length) { zone.append(el('p', { class: 'vide', text: 'Aucun participant ne correspond à cette recherche.' })); return; }
  for (const p of liste) zone.append(carteParticipant(p));
}
$('recherche').addEventListener('input', afficherParticipants);
$('filtre-statut').addEventListener('change', afficherParticipants);

function carteParticipant(p) {
  const statuts = el('div', { class: 'segmente', role: 'group', 'aria-label': `Statut de ${p.prenom} ${p.nom}` },
    Object.entries(STATUTS).map(([val, lib]) => el('button', {
      type: 'button', class: `segmente__btn segmente__btn--${val}`, 'aria-pressed': String(p.statut === val),
      onclick: () => changerStatut(p, val),
    }, lib)));

  const infos = el('dl', { class: 'infos' },
    el('dt', { text: 'E-mail' }), el('dd', {}, el('a', { href: `mailto:${p.email}`, text: p.email })),
    el('dt', { text: 'Téléphone' }), el('dd', {}, p.telephone ? el('a', { href: `tel:${p.telephone.replace(/[^0-9+]/g, '')}`, text: p.telephone }) : '—'),
    el('dt', { text: 'Allergènes' }), el('dd', { text: p.allergenes }),
    el('dt', { text: 'Description' }), el('dd', { text: p.description || '—' }),
    el('dt', { text: 'Droit à l’image' }), el('dd', { text: p.consent_image ? 'Accepté' : 'Refusé' }),
    el('dt', { text: 'Inscription' }), el('dd', { text: dateFr(p.date_inscription) }));

  const carte = el('article', { class: `carte-p carte-p--${p.statut}` },
    el('header', { class: 'carte-p__tete' },
      el('span', { class: 'dossard', text: `n° ${p.dossard}` }),
      el('div', {}, el('h2', { text: `${p.prenom} ${p.nom}` }), el('p', { class: 'carte-p__creation', text: `« ${p.nom_creation} »` }))),
    statuts, infos);

  if (etat.role === 'gerante') {
    const zoneSuppr = el('div', { class: 'carte-p__actions' });
    const btn = el('button', { type: 'button', class: 'bouton bouton--petit bouton--danger', text: 'Supprimer l’inscription' });
    btn.addEventListener('click', () => {
      zoneSuppr.innerHTML = '';
      zoneSuppr.append(
        el('p', { class: 'confirmer', text: `Supprimer définitivement ${p.prenom} ${p.nom} et ses notes ? Cette action est irréversible.` }),
        el('button', { type: 'button', class: 'bouton bouton--petit bouton--danger', onclick: () => supprimer(p) }, 'Oui, supprimer'),
        el('button', { type: 'button', class: 'bouton bouton--petit bouton--secondaire', onclick: () => { zoneSuppr.innerHTML = ''; zoneSuppr.append(btn); } }, 'Annuler'));
    });
    zoneSuppr.append(btn);
    carte.append(zoneSuppr);
  }
  return carte;
}

async function changerStatut(p, statut) {
  if (p.statut === statut) return;
  const { error } = await sb.rpc('changer_statut', { p_id: p.id, p_statut: statut });
  if (error) { alerteApp(messageErreur(error)); return; }
  p.statut = statut;
  alerteApp(`${p.prenom} ${p.nom} : statut « ${STATUTS[statut]} » enregistré à ${heureFr()}.`, true);
  afficherParticipants();
}

async function supprimer(p) {
  const { error, count } = await sb.from('participants').delete({ count: 'exact' }).eq('id', p.id);
  if (error || count === 0) { alerteApp(error ? messageErreur(error) : 'Suppression refusée.'); return; }
  etat.participants = etat.participants.filter((x) => x.id !== p.id);
  alerteApp(`Inscription de ${p.prenom} ${p.nom} supprimée.`, true);
  afficherParticipants();
}

// ---------------------------------------------------------------- notation (juré)
async function chargerNotation() {
  const [creations, notes] = await Promise.all([
    sb.rpc('creations_a_noter'),
    sb.from('notes').select('participant_id, critere_id, valeur'),
  ]);
  if (creations.error || notes.error) { alerteApp(messageErreur(creations.error || notes.error)); return; }
  const mesNotes = {};
  for (const n of notes.data) (mesNotes[n.participant_id] ||= {})[n.critere_id] = n.valeur;

  const zone = $('liste-notation');
  zone.innerHTML = '';
  if (!creations.data.length) {
    zone.append(el('p', { class: 'vide', text: 'Aucune création à noter pour l’instant : l’équipe doit d’abord pointer les participants « présents » à l’accueil.' }));
    $('progression-notation').textContent = '';
    return;
  }
  const majProgression = () => {
    const faites = creations.data.filter((c) => etat.criteres.every((cr) => mesNotes[c.participant_id]?.[cr.id] != null)).length;
    $('progression-notation').textContent = `Vous avez noté ${faites} création${faites > 1 ? 's' : ''} sur ${creations.data.length}.`;
  };
  for (const c of creations.data) zone.append(carteNotation(c, mesNotes, majProgression));
  majProgression();
}

function carteNotation(c, mesNotes, majProgression) {
  const existantes = mesNotes[c.participant_id] || {};
  const complete = () => etat.criteres.every((cr) => mesNotes[c.participant_id]?.[cr.id] != null);
  const etatCarte = el('p', { class: 'etat-notation', 'aria-live': 'polite' });
  const majEtat = () => {
    etatCarte.textContent = complete() ? '✓ Noté' : 'À noter';
    etatCarte.dataset.complet = String(complete());
  };

  const form = el('form', { class: 'form-notes', novalidate: true });
  for (const cr of etat.criteres) {
    const nom = `n-${c.participant_id}-${cr.id}`;
    const fs = el('fieldset', { class: 'critere' },
      el('legend', {}, `${cr.libelle} `, el('span', { class: 'coef', text: `(sur ${cr.note_max}, coef. ${cr.coefficient})` })));
    const echelle = el('div', { class: 'echelle' });
    for (let v = 0; v <= cr.note_max; v++) {
      const id = `${nom}-${v}`;
      echelle.append(el('input', { type: 'radio', name: nom, id, value: String(v), checked: existantes[cr.id] === v, 'data-critere': cr.id }),
        el('label', { for: id, text: String(v) }));
    }
    fs.append(echelle);
    form.append(fs);
  }
  const msg = el('p', { class: 'msg-notes', role: 'status' });
  form.append(el('button', { type: 'submit', class: 'bouton bouton--plein' }, 'Enregistrer mes notes'), msg);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const lignes = [];
    const manquants = [];
    for (const cr of etat.criteres) {
      const choix = form.querySelector(`input[data-critere="${cr.id}"]:checked`);
      if (!choix) manquants.push(cr.libelle);
      else lignes.push({ participant_id: c.participant_id, jure_id: etat.user.id, critere_id: cr.id, valeur: Number(choix.value) });
    }
    if (manquants.length) {
      msg.className = 'msg-notes msg-notes--erreur';
      msg.textContent = `Notes non enregistrées : choisissez une note pour ${manquants.join(', ')}.`;
      return;
    }
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = 'Enregistrement…';
    const { error } = await sb.from('notes').upsert(lignes, { onConflict: 'participant_id,jure_id,critere_id' });
    btn.disabled = false; btn.textContent = 'Enregistrer mes notes';
    if (error) { msg.className = 'msg-notes msg-notes--erreur'; msg.textContent = messageErreur(error); return; }
    mesNotes[c.participant_id] = Object.fromEntries(lignes.map((l) => [l.critere_id, l.valeur]));
    msg.className = 'msg-notes msg-notes--ok';
    msg.textContent = `Notes enregistrées à ${heureFr()}.`;
    majEtat(); majProgression();
  });

  majEtat();
  return el('article', { class: 'carte-p' },
    el('header', { class: 'carte-p__tete' },
      el('span', { class: 'dossard', text: `n° ${c.dossard}` }),
      el('div', {}, el('h2', { text: c.nom_creation }), etatCarte)),
    el('dl', { class: 'infos' },
      el('dt', { text: 'Description' }), el('dd', { text: c.description || '—' }),
      el('dt', { text: 'Allergènes' }), el('dd', { text: c.allergenes })),
    form);
}

// ---------------------------------------------------------------- classement (gérante)
$('btn-actualiser-classement').addEventListener('click', chargerClassement);

async function chargerClassement() {
  const [cl, notes, profils] = await Promise.all([
    sb.rpc('classement'),
    sb.from('notes').select('participant_id, jure_id, critere_id, valeur'),
    sb.from('profils').select('id, nom, role').eq('role', 'jure').order('nom'),
  ]);
  const zone = $('classement');
  zone.innerHTML = '';
  if (cl.error) { alerteApp(messageErreur(cl.error)); return; }
  const classes = cl.data.filter((r) => r.rang != null);
  const incomplets = cl.data.filter((r) => r.rang == null);
  zone.append(el('p', { class: 'aide', text: `Mis à jour à ${heureFr()}.` }));

  if (!classes.length) zone.append(el('p', { class: 'vide', text: 'Aucun participant n’a encore été noté par tous les jurés.' }));
  else {
    const tb = el('tbody');
    for (const r of classes) {
      tb.append(el('tr', { class: r.rang <= 3 ? `podium podium--${r.rang}` : '' },
        el('td', { class: 'rang', text: String(r.rang) }),
        el('td', {}, el('strong', { text: `${r.prenom} ${r.nom}` }), el('br'), el('span', { class: 'petit', text: `n° ${r.dossard} · « ${r.nom_creation} »` }),
          r.ex_aequo ? el('span', { class: 'ex-aequo', text: 'Ex æquo : décision du jury' }) : null),
        el('td', { class: 'num' }, el('strong', { text: fmt(r.note_finale) }), ' / 20'),
        el('td', { class: 'num', text: fmt(r.moyenne_departage) })));
    }
    zone.append(el('div', { class: 'tableau-defile' }, el('table', { class: 'tableau-classement' },
      el('thead', {}, el('tr', {}, el('th', { scope: 'col', text: 'Rang' }), el('th', { scope: 'col', text: 'Participant' }),
        el('th', { scope: 'col', text: 'Note finale' }), el('th', { scope: 'col', text: 'Moy. Goût' }))), tb)));
  }
  if (incomplets.length) {
    zone.append(el('h2', { class: 'h2-simple', text: 'Notation incomplète (non classés)' }),
      el('ul', { class: 'liste-simple' }, incomplets.map((r) =>
        el('li', { text: `n° ${r.dossard} · ${r.prenom} ${r.nom} · « ${r.nom_creation} » : ${r.jures_complets} juré(s) sur ${r.jures_total} ont tout noté${r.statut === 'present' ? '' : ` (statut : ${STATUTS[r.statut]})`}` }))));
  }

  // Détail des notes par juré, pour vérifier le calcul à la main
  if (!notes.error && !profils.error && notes.data.length) {
    const det = el('details', { class: 'detail-notes' }, el('summary', { text: 'Détail des notes par juré (vérification du calcul)' }));
    const ent = el('tr', {}, el('th', { scope: 'col', text: 'Participant' }),
      ...profils.data.map((j) => el('th', { scope: 'col', text: `${j.nom} : ${etat.criteres.map((c) => c.libelle.split(' ')[0][0]).join(' / ')} → /20` })));
    const tb = el('tbody');
    for (const r of cl.data.filter((x) => x.jures_complets > 0 || notes.data.some((n) => n.participant_id === x.participant_id))) {
      const cells = profils.data.map((j) => {
        const v = etat.criteres.map((c) => notes.data.find((n) => n.participant_id === r.participant_id && n.jure_id === j.id && n.critere_id === c.id)?.valeur);
        if (v.some((x) => x == null)) return el('td', { text: v.map((x) => x ?? '·').join(' / ') + ' (incomplet)' });
        const somme = etat.criteres.reduce((s, c, i) => s + v[i] * c.coefficient, 0);
        const max = etat.criteres.reduce((s, c) => s + c.note_max * c.coefficient, 0);
        return el('td', { text: `${v.join(' / ')} → ${fmt((somme / max) * 20)}` });
      });
      tb.append(el('tr', {}, el('th', { scope: 'row', text: `n° ${r.dossard} ${r.prenom} ${r.nom}` }), ...cells));
    }
    det.append(el('p', { class: 'aide', text: `Légende : ${etat.criteres.map((c) => `${c.libelle.split(' ')[0][0]} = ${c.libelle} (coef. ${c.coefficient})`).join(' ; ')}.` }),
      el('div', { class: 'tableau-defile' }, el('table', { class: 'tableau-classement' }, el('thead', {}, ent), tb)));
    zone.append(det);
  }
}

// ---------------------------------------------------------------- e-mails (gérante)
async function chargerEmails() {
  const { data, error } = await sb.from('participants').select('*').order('dossard');
  if (error) { alerteApp(messageErreur(error)); return; }
  etat.participants = data;
  const sel = $('choix-participant-mail');
  sel.innerHTML = '';
  const zone = $('apercus-emails');
  const dest = $('destinataires-rappel');
  zone.innerHTML = ''; dest.innerHTML = '';
  if (!data.length) {
    sel.append(el('option', { value: '', text: 'Aucun participant' }));
    zone.append(el('p', { class: 'vide', text: 'Aucune inscription : rien à prévisualiser.' }));
    return;
  }
  for (const p of data) sel.append(el('option', { value: p.id, text: `n° ${p.dossard} · ${p.prenom} ${p.nom}` }));
  const afficher = () => {
    const p = data.find((x) => x.id === sel.value);
    zone.innerHTML = '';
    zone.append(blocApercu(emailConfirmation(p), 'E-mail de confirmation'), blocApercu(emailRappel(p), 'E-mail de rappel'));
  };
  sel.onchange = afficher;
  afficher();
  const cibles = data.filter((p) => p.statut !== 'desiste');
  for (const p of cibles) dest.append(el('li', { text: `${p.prenom} ${p.nom} <${p.email}>` }));
  if (!cibles.length) dest.append(el('li', { text: 'Aucun destinataire (tous désistés).' }));
}

sbReady();
function sbReady() { demarrer().catch(() => afficherConnexion('Erreur de chargement. Rechargez la page.')); }
