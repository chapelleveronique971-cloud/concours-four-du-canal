// =====================================================================
// Réglages du prototype — seul fichier à modifier pour brancher Supabase.
// La « clé anon » de Supabase est publique par nature (elle est visible
// dans toute page web) : la sécurité repose sur les règles d'accès de la base.
// =====================================================================
export const SUPABASE_URL = 'https://afrbmfikyflrhlsixxti.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_j7m28F639pgGfeQ31VjRNA_PolXv8kf'; // clé publique (Publishable key)

export const supabaseConfigure = () =>
  !SUPABASE_URL.startsWith('A_REMPLIR') && !SUPABASE_ANON_KEY.startsWith('A_REMPLIR');

// Informations du concours — hypothèses [H] de CADRAGE.md
export const CONCOURS = {
  nom: 'Concours amateur de pâtisserie du Four du Canal',
  theme: 'Pâtisserie d’hiver',
  dateLongue: 'samedi 5 décembre 2026',
  horaires: '14 h – 18 h',
  lieu: 'À la pâtisserie Le Four du Canal',
  adresse: '[adresse à préciser]',
  contact: '[e-mail de contact à préciser]',
  jauge: 20,
  conservation: 'trois mois après le concours (soit jusqu’au 5 mars 2027)',
  // Lien de retour vers le site WordPress : laisser vide tant que l'URL n'est pas connue
  // (le lien n'est alors pas affiché).
  siteWordPress: '',
};
