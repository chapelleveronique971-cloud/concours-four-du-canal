// Vérifications du formulaire d'inscription, faites dans le navigateur
// pour aider la personne. Les mêmes règles sont refaites par la base
// de données (fonction inscrire), qui a le dernier mot.

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;

export const LIMITES = { nom: 80, prenom: 80, nom_creation: 120, description: 600, allergenes: 300 };

export function telephoneValide(tel) {
  const t = tel.trim();
  if (!t) return true; // facultatif
  if (!/^\+?[0-9 .()-]+$/.test(t)) return false;
  const chiffres = t.replace(/[^0-9]/g, '').length;
  return chiffres >= 10 && chiffres <= 15;
}

/**
 * Renvoie un objet { champ: message } ; vide si tout est correct.
 * @param {object} d valeurs du formulaire
 */
export function valider(d) {
  const e = {};
  const vide = (v) => !v || !String(v).trim();

  if (vide(d.prenom)) e.prenom = 'Indiquez votre prénom.';
  else if (d.prenom.trim().length > LIMITES.prenom) e.prenom = `Le prénom ne doit pas dépasser ${LIMITES.prenom} caractères.`;

  if (vide(d.nom)) e.nom = 'Indiquez votre nom.';
  else if (d.nom.trim().length > LIMITES.nom) e.nom = `Le nom ne doit pas dépasser ${LIMITES.nom} caractères.`;

  if (vide(d.email)) e.email = 'Indiquez votre adresse e-mail.';
  else if (!EMAIL_RE.test(d.email.trim())) e.email = 'Cette adresse e-mail ne semble pas valide (exemple attendu : prenom.nom@exemple.fr).';

  if (!telephoneValide(d.telephone || '')) e.telephone = 'Ce numéro ne semble pas valide (10 chiffres, exemple : 06 12 34 56 78). Ce champ est facultatif : vous pouvez le laisser vide.';

  if (vide(d.nom_creation)) e.nom_creation = 'Donnez un nom à votre création (même provisoire).';
  else if (d.nom_creation.trim().length > LIMITES.nom_creation) e.nom_creation = `Le nom de la création ne doit pas dépasser ${LIMITES.nom_creation} caractères.`;

  if ((d.description || '').length > LIMITES.description) e.description = `La description ne doit pas dépasser ${LIMITES.description} caractères.`;

  if (vide(d.allergenes)) e.allergenes = 'Indiquez les allergènes présents dans votre création, ou « aucun ».';
  else if (d.allergenes.trim().length > LIMITES.allergenes) e.allergenes = `Ce champ ne doit pas dépasser ${LIMITES.allergenes} caractères.`;

  if (!d.majeur) e.majeur = 'Le concours est réservé aux amateurs de 18 ans et plus : cochez cette case pour l’attester.';
  if (!d.reglement) e.reglement = 'Vous devez accepter le règlement pour vous inscrire.';
  if (!d.donnees) e.donnees = 'Votre accord est nécessaire pour que nous puissions traiter votre inscription.';
  return e;
}

/** Traduit un code d'erreur renvoyé par la base en { champ, message }. */
export function erreurServeur(message = '') {
  const [code, champ] = message.split(':');
  switch (code) {
    case 'DEJA_INSCRIT':
      return { champ: 'email', message: 'Cette adresse e-mail est déjà inscrite au concours. Votre inscription n’a pas été enregistrée une seconde fois.' };
    case 'COMPLET':
      return { champ: null, complet: true, message: 'Le concours est complet : les 20 places ont été attribuées. Votre inscription n’a pas été enregistrée.' };
    case 'EMAIL_INVALIDE':
      return { champ: 'email', message: 'Cette adresse e-mail ne semble pas valide.' };
    case 'TELEPHONE_INVALIDE':
      return { champ: 'telephone', message: 'Ce numéro de téléphone ne semble pas valide.' };
    case 'CHAMP_MANQUANT':
      return { champ, message: 'Ce champ est obligatoire.' };
    case 'CHAMP_TROP_LONG':
      return { champ, message: 'Ce texte est trop long.' };
    case 'CONSENTEMENT_MANQUANT':
      return { champ, message: 'Cette case doit être cochée pour vous inscrire.' };
    default:
      return { champ: null, message: 'L’inscription n’a pas pu être enregistrée (problème technique ou de connexion). Vérifiez votre connexion internet puis réessayez.' };
  }
}
