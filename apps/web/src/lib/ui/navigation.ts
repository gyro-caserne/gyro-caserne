export type EntreeNavigation = { href: string; libelle: string; icone: string };

const accueil = { href: '/', libelle: 'Accueil', icone: 'accueil' };
const planning = { href: '/planning', libelle: 'Planning', icone: 'planning' };
const caserne = { href: '/caserne', libelle: 'Caserne', icone: 'caserne' };
const echanges = { href: '/echanges', libelle: 'Échanges', icone: 'echanges' };
const connexion = { href: '/connexion', libelle: 'Connexion', icone: 'connexion' };
const affichage = { href: '/affichage', libelle: 'Affichage', icone: 'affichage' };

// Les droits n'ajoutent pas d'onglet : ils ajoutent des boutons dans les pages.
// Une personne extérieure (retraité, réserve citoyenne) n'a pas de planning, et Caserne seulement si elle peut réserver.
export function entreesNavigation(connecte: boolean, { exterieur = false, caserne: avecCaserne = true } = {}): EntreeNavigation[] {
	if (!connecte) return [connexion, affichage];
	if (exterieur) return avecCaserne ? [accueil, caserne, echanges] : [accueil, echanges];
	return [accueil, planning, caserne, echanges];
}

// Les pages rangées sous un onglet, ou sous « Moi », en plus de la sienne.
const rangement: Record<string, string[]> = {
	'/planning': ['/remplacements'],
	'/caserne': ['/agents', '/comites', '/engins', '/nominations', '/reglages', '/reservations', '/habillement', '/demandes', '/suivi'],
	'/moi': ['/profil', '/affichage']
};

const sous = (chemin: string, racine: string) => chemin === racine || chemin.startsWith(`${racine}/`);

// Une conversation ouverte prend tout l'écran du téléphone ; une page d'erreur garde sa navigation.
export function dansUneConversation(route: string | null, erreur: unknown): boolean {
	return !erreur && (route === '/echanges/messages/[id]' || route === '/echanges/messages/a/[personne]');
}

// Les pages dont l'ouverture marque des notifications lues (mur, publication, remplacements, anomalie, mes réservations, demande à un référent, suivi du centre) :
// la cloche n'est relue qu'après elles, pour ne pas ajouter un appel au serveur à chaque page.
const MARQUENT_LU = ['/echanges/[mur]', '/echanges/[mur]/[id]', '/remplacements', '/remplacements/[id]', '/planning/ete', '/engins/anomalies/[id]', '/reservations/miennes', '/demandes/[id]', '/suivi'];
export function marqueDesLues(route: string | null): boolean {
	return route !== null && MARQUENT_LU.includes(route);
}

// L'entrée (onglet, « Moi » ou cloche) dont descend la page courante.
export function rubriqueDe(chemin: string): string {
	if (chemin === '/') return '/';
	for (const racine of ['/planning', '/caserne', '/echanges', '/notifications', '/moi']) {
		if (sous(chemin, racine) || (rangement[racine] ?? []).some((r) => sous(chemin, r))) return racine;
	}
	return chemin;
}
