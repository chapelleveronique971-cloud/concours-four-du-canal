// Page publique : compteur de places + formulaire d'inscription.
import { SUPABASE_URL, SUPABASE_ANON_KEY, supabaseConfigure, CONCOURS } from './config.js';
import { valider, erreurServeur } from './validation.js';
import { emailConfirmation, blocApercu } from './emails.js';

const sb = supabaseConfigure() ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const form = document.getElementById('form-inscription');
const alerte = document.getElementById('alerte');
const btn = document.getElementById('btn-envoyer');
const confirmation = document.getElementById('confirmation');
const places = document.getElementById('places');

const LIBELLES = {
  prenom: 'Prénom', nom: 'Nom', email: 'Adresse e-mail', telephone: 'Téléphone',
  nom_creation: 'Nom de la création', description: 'Description', allergenes: 'Allergènes',
  majeur: 'Attestation de majorité', reglement: 'Règlement', donnees: 'Utilisation des données',
};

// Textes RGPD et lien WordPress issus de la configuration
document.getElementById('rgpd-duree').textContent = CONCOURS.conservation;
document.getElementById('rgpd-contact').textContent = CONCOURS.contact;
if (CONCOURS.siteWordPress) {
  const l = document.getElementById('lien-wordpress');
  l.href = CONCOURS.siteWordPress; l.hidden = false;
}

// ---------- Compteur de places ----------
function afficherComplet() {
  places.textContent = 'Complet : les 20 places sont attribuées.';
  places.classList.add('places--complet');
  form.hidden = true;
  document.getElementById('cta-hero').hidden = true;
  montrerAlerte('Le concours est complet : les 20 places ont été attribuées. Les inscriptions sont fermées.', [], true);
}

async function chargerPlaces() {
  if (!sb) return;
  const { data, error } = await sb.rpc('places_restantes');
  if (error || typeof data !== 'number') return; // on n'affiche rien plutôt qu'un chiffre faux
  if (data <= 0) { afficherComplet(); return; }
  // Preuve sociale + rareté, à partir du chiffre réel de la base (jamais inventé)
  const inscrits = CONCOURS.jauge - data;
  const reste = data === 1 ? 'plus qu’une place disponible !' : `${data} places restantes sur ${CONCOURS.jauge}.`;
  places.textContent = inscrits === 0 ? `${data} places disponibles : soyez parmi les premiers !`
    : `${inscrits} pâtissier${inscrits > 1 ? 's' : ''} amateur${inscrits > 1 ? 's' : ''} déjà inscrit${inscrits > 1 ? 's' : ''} · ${reste}`;
  const r = document.getElementById('reassurance-places');
  if (r) r.textContent = data === 1 ? 'Dernière place !' : `Plus que ${data} places`;
}

// ---------- Erreurs ----------
function lireFormulaire() {
  const f = new FormData(form);
  return {
    prenom: f.get('prenom') || '', nom: f.get('nom') || '', email: f.get('email') || '',
    telephone: f.get('telephone') || '', nom_creation: f.get('nom_creation') || '',
    description: f.get('description') || '', allergenes: f.get('allergenes') || '',
    majeur: form.majeur.checked, reglement: form.reglement.checked,
    donnees: form.donnees.checked, consent_image: form.image.checked,
  };
}

function effacerErreurs() {
  form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
  form.querySelectorAll('.erreur').forEach((el) => { el.textContent = ''; });
  alerte.hidden = true; alerte.innerHTML = ''; alerte.className = 'alerte';
}

function marquerErreur(champ, message) {
  const input = form.elements[champ];
  const zone = document.getElementById(`err-${champ}`);
  if (input) input.setAttribute('aria-invalid', 'true');
  if (zone) zone.textContent = message;
}

function montrerAlerte(titre, champs = [], info = false) {
  alerte.className = info ? 'alerte alerte--info' : 'alerte';
  alerte.textContent = titre;
  if (champs.length) {
    const ul = document.createElement('ul');
    for (const c of champs) {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = `#${c}`; a.textContent = LIBELLES[c] || c;
      a.addEventListener('click', (e) => { e.preventDefault(); form.elements[c]?.focus(); });
      li.append(a); ul.append(li);
    }
    alerte.append(ul);
  }
  alerte.hidden = false;
  alerte.focus();
}

// Une fois une première tentative faite, on revérifie chaque champ quand on le quitte
let tentative = false;
form.addEventListener('focusout', (e) => {
  if (!tentative || !e.target.name) return;
  const champ = e.target.name === 'image' ? null : e.target.name;
  if (!champ) return;
  const err = valider(lireFormulaire())[champ];
  const zone = document.getElementById(`err-${champ}`);
  if (err) marquerErreur(champ, err);
  else { e.target.removeAttribute('aria-invalid'); if (zone) zone.textContent = ''; }
});

// ---------- Envoi ----------
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  tentative = true;
  effacerErreurs();
  const d = lireFormulaire();
  const erreurs = valider(d);
  const champs = Object.keys(erreurs);
  if (champs.length) {
    champs.forEach((c) => marquerErreur(c, erreurs[c]));
    montrerAlerte(champs.length === 1 ? 'Votre inscription n’est pas envoyée : 1 champ est à corriger.'
      : `Votre inscription n’est pas envoyée : ${champs.length} champs sont à corriger.`, champs);
    return;
  }
  if (!sb) {
    montrerAlerte('Le service d’inscription n’est pas encore branché (configuration Supabase manquante). Aucune inscription n’a été enregistrée.');
    return;
  }

  btn.disabled = true; btn.textContent = 'Envoi en cours…';
  const { error } = await sb.rpc('inscrire', {
    p_nom: d.nom, p_prenom: d.prenom, p_email: d.email, p_telephone: d.telephone,
    p_nom_creation: d.nom_creation, p_description: d.description, p_allergenes: d.allergenes,
    p_majeur: d.majeur, p_reglement: d.reglement, p_donnees: d.donnees, p_image: d.consent_image,
  });
  btn.disabled = false; btn.textContent = 'Envoyer mon inscription';

  if (error) {
    const err = erreurServeur(error.message);
    if (err.complet) { afficherComplet(); alerte.textContent = err.message; return; }
    if (err.champ) { marquerErreur(err.champ, err.message); montrerAlerte('Votre inscription n’a pas été enregistrée.', [err.champ]); }
    else montrerAlerte(err.message);
    return;
  }
  afficherConfirmation({ ...d, nom: d.nom.trim(), prenom: d.prenom.trim(), email: d.email.trim().toLowerCase(),
    nom_creation: d.nom_creation.trim(), allergenes: d.allergenes.trim() });
  chargerPlaces();
});

function afficherConfirmation(p) {
  form.hidden = true;
  alerte.hidden = true;
  confirmation.innerHTML = '';
  const h = document.createElement('h3');
  h.textContent = `Merci ${p.prenom}, votre inscription est enregistrée !`;
  const t = document.createElement('p');
  t.textContent = `Rendez-vous le ${CONCOURS.dateLongue} à 14 h avec votre création « ${p.nom_creation} » et sa fiche allergènes.`;
  const n = document.createElement('p');
  n.textContent = 'Prototype : aucun e-mail ne vous est envoyé. Voici le contenu de l’e-mail de confirmation prévu dans la version finale.';
  confirmation.append(h, t, n, blocApercu(emailConfirmation(p), 'E-mail de confirmation'));
  confirmation.hidden = false;
  confirmation.focus();
  confirmation.scrollIntoView({ block: 'start' });
}

chargerPlaces();
