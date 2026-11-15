// Contenu des e-mails prévus au CADRAGE. AUCUN ENVOI : le prototype
// se contente d'afficher ce contenu (l'envoi automatique est prévu en V2).
import { CONCOURS as C } from './config.js';

export function emailConfirmation(p) {
  return {
    declencheur: 'Inscription enregistrée',
    destinataire: `${p.prenom} ${p.nom} <${p.email}>`,
    objet: `Votre inscription au concours « ${C.theme} » est confirmée`,
    corps:
`Bonjour ${p.prenom},

Votre inscription au ${C.nom} est bien enregistrée. Merci !

Récapitulatif
• Participant·e : ${p.prenom} ${p.nom}
• Votre création : ${p.nom_creation}
• Allergènes déclarés : ${p.allergenes}
• Droit à l'image : ${p.consent_image ? 'accepté' : 'non accepté'}

Le jour J
• Date : ${C.dateLongue}, ${C.horaires}
• Lieu : ${C.lieu}, ${C.adresse}
• Thème : « ${C.theme} » — création réalisée à domicile et apportée sur place.

Le règlement complet est disponible sur la page du concours.
Une question ? Contactez-nous : ${C.contact}

Vous ne pouvez plus participer ? [lien de désinscription : prévu en V2]

À très bientôt,
L'équipe du Four du Canal`,
  };
}

export function emailRappel(p) {
  return {
    declencheur: '48 h avant l’événement (jeudi 3 décembre 2026, 14 h)',
    destinataire: `${p.prenom} ${p.nom} <${p.email}>`,
    objet: `J-2 : rendez-vous ${C.dateLongue} pour le concours « ${C.theme} »`,
    corps:
`Bonjour ${p.prenom},

Le concours approche ! Rendez-vous ${C.dateLongue}.

• Heure d'arrivée : 14 h [heure exacte à préciser]
• Adresse : ${C.lieu}, ${C.adresse}

À ne pas oublier
• Votre création « ${p.nom_creation} », réalisée à domicile.
• Sa fiche allergènes (vous avez déclaré : ${p.allergenes}).

Un empêchement ? Prévenez-nous : ${C.contact}

À samedi,
L'équipe du Four du Canal`,
  };
}

/** Construit le bloc HTML d'aperçu (texte échappé, jamais interprété). */
export function blocApercu(mail, titre) {
  const wrap = document.createElement('section');
  wrap.className = 'apercu-mail';
  wrap.setAttribute('aria-label', titre);
  const h = document.createElement('p');
  h.className = 'apercu-mail__bandeau';
  h.textContent = `${titre} — aperçu seulement : cet e-mail n’est pas envoyé (prototype).`;
  const dl = document.createElement('dl');
  for (const [k, v] of [['Déclencheur', mail.declencheur], ['À', mail.destinataire], ['Objet', mail.objet]]) {
    const dt = document.createElement('dt'); dt.textContent = k;
    const dd = document.createElement('dd'); dd.textContent = v;
    dl.append(dt, dd);
  }
  const pre = document.createElement('pre');
  pre.textContent = mail.corps;
  wrap.append(h, dl, pre);
  return wrap;
}
