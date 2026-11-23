import { eq } from 'drizzle-orm';
import { attribution, demandeReferent, personne, reglerDemandes, responsabilite } from '@gyro-caserne/socle';
import { describe, expect, it } from 'vitest';
import { locaux, preparer, requeteFormulaire } from '../echanges/de-test.ts';
import { actions, load } from './+page.server';
import { actions as actionsDemande, load as demande } from './[id]/+page.server';
import { actions as actionsRole, load as role } from './role/[id]/+page.server';

/* eslint-disable @typescript-eslint/no-explicit-any */
// Bruno, référent pharmacie ; la pharmacie a une étape « Commandée » et finit sur « Livrée ».
async function jeu() {
	const p = await preparer();
	const [r] = await p.base.select().from(responsabilite).where(eq(responsabilite.nom, 'Référent pharmacie'));
	await p.base.insert(attribution).values({ personneId: p.bruno.id, responsabiliteId: r!.id, perimetreType: 'centre', perimetreId: null, debut: '2026-01-01', saisiePar: 'super:a@b.fr', saisieLe: '2026-01-01' });
	await reglerDemandes(p.base, p.chef, r!.id, { etapes: [{ nom: 'Commandée' }], derniere: 'Livrée' }, '2026-11-23T10:00');
	const commandee = (await p.base.select().from(responsabilite).where(eq(responsabilite.id, r!.id)))[0]!.demandes!.etapes[0]!.id;
	const demander = async (acteur: unknown, texte: string, roleId = r!.id) => (actions.default as any)({ locals: locaux(p.base, acteur), request: await requeteFormulaire([['role', String(roleId)], ['texte', texte]]), url: new URL('http://x/demandes') });
	const geste = async (acteur: unknown, id: number, corps: [string, string][]) => (actionsDemande.default as any)({ locals: locaux(p.base, acteur), params: { id: String(id) }, request: await requeteFormulaire(corps) });
	const ouvrir = (acteur: unknown, id: number | string) => (demande as any)({ locals: locaux(p.base, acteur), params: { id: String(id) }, url: new URL(`http://x/demandes/${id}`) });
	const liste = (acteur: unknown, id = r!.id) => (role as any)({ locals: locaux(p.base, acteur), params: { id: String(id) } });
	return { ...p, pharmacie: r!.id, commandee, referent: p.bruno, demander, geste, ouvrir, liste };
}
const idDe = async (promesse: Promise<unknown>) => {
	const r = (await promesse.catch((e) => e)) as { status: number; location: string };
	expect(r.status).toBe(303);
	return Number(/\/demandes\/(\d+)\?envoyee$/.exec(r.location)![1]);
};

describe('/demandes', () => {
	it('demande la connexion ; le rôle de l’adresse est choisi d’avance ; les rôles qui reçoivent, avec leur icône', async () => {
		const { base, alice, pharmacie } = await jeu();
		await expect((load as any)({ locals: locaux(base, null), url: new URL('http://x/demandes') })).rejects.toMatchObject({ status: 303, location: '/connexion' });
		const data = await (load as any)({ locals: locaux(base, alice), url: new URL(`http://x/demandes?role=${pharmacie}`) });
		expect(data).toMatchObject({ peutDemander: true, choisi: pharmacie, recus: [] });
		expect(data.roles).toEqual([expect.objectContaining({ nom: 'Référent engins', icone: 'camion' }), expect.objectContaining({ nom: 'Référent pharmacie', icone: 'croix' })]);
		expect((await (load as any)({ locals: locaux(base, alice), url: new URL('http://x/demandes?role=999') })).choisi).toBeNull();
	});

	it('envoyer une demande mène à son suivi ; vide ou sans rôle, refusée avec une phrase, la saisie gardée', async () => {
		const { base, alice, demander } = await jeu();
		const id = await idDe(demander(alice, 'Compresses stériles'));
		expect((await (load as any)({ locals: locaux(base, alice), url: new URL('http://x/demandes') })).enCours.map((d: { id: number }) => d.id)).toEqual([id]);
		expect(await demander(alice, '   ')).toMatchObject({ status: 400, data: { texte: '   ', champ: 'texte', message: 'Décrivez votre besoin, ce qu’il vous faut et pourquoi.' } });
		expect(await demander(alice, 'Gants', 0)).toMatchObject({ status: 400, data: { champ: 'role', message: 'Choisissez à qui adresser la demande.' } });
	});

	it('le référent voit ce qu’il reçoit ; la liste du rôle lui est ouverte, refusée à un agent', async () => {
		const { base, alice, referent, demander, liste, pharmacie } = await jeu();
		await idDe(demander(alice, 'Compresses'));
		expect((await (load as any)({ locals: locaux(base, referent), url: new URL('http://x/demandes') })).recus).toMatchObject([{ id: pharmacie, enCours: 1 }]);
		expect(await liste(referent)).toMatchObject({ role: { nom: 'Référent pharmacie', icone: 'croix' }, titulaire: true, regler: 'etapes', enCours: [{ texte: 'Compresses' }] });
		await expect(liste(alice)).rejects.toMatchObject({ status: 403 });
	});

	it('le titulaire règle les étapes depuis la liste de son rôle : l’aperçu ne change rien, « Enregistrer les étapes » enregistre ; il ne décoche pas', async () => {
		const { base, referent, pharmacie } = await jeu();
		const agir = async (nom: 'demandes' | 'apercu', corps: [string, string][]) => (actionsRole[nom] as any)({ locals: locaux(base, referent), params: { id: String(pharmacie) }, request: await requeteFormulaire(corps) });
		const etapes = async () => (await base.select().from(responsabilite).where(eq(responsabilite.id, pharmacie)))[0]!.demandes;
		const [commandee] = (await etapes())!.etapes;
		expect(await agir('apercu', [['demandes', '1'], ['etape-id', commandee!.id], ['etape-nom', 'Commandée'], ['derniere', 'Livrée'], ['nouvelle', 'Reçue'], ['geste', 'ajouter']])).toMatchObject({ cible: 'demandes', demandes: { etapes: [{ nom: 'Commandée' }, { nom: 'Reçue' }] } });
		expect((await etapes())!.etapes.map((e) => e.nom)).toEqual(['Commandée']);
		expect(await agir('demandes', [['demandes', '1'], ['etape-id', commandee!.id], ['etape-nom', 'Commandée'], ['etape-id', ''], ['etape-nom', 'Reçue'], ['derniere', 'Livrée']])).toMatchObject({ cible: 'demandes', succes: 'Étapes enregistrées.' });
		expect((await etapes())!.etapes.map((e) => e.nom)).toEqual(['Commandée', 'Reçue']);
		expect(await agir('demandes', [['demandes', '1'], ['case-demandes', '1'], ['derniere', 'Livrée']])).toMatchObject({ status: 403 });
	});
});

describe('/demandes/[id]', () => {
	it('404 pour un autre agent ou une adresse inconnue ; les gestes de qui gère', async () => {
		const { alice, chef, demander, ouvrir, base } = await jeu();
		const id = await idDe(demander(alice, 'Compresses'));
		expect((await base.select().from(demandeReferent))[0]!.id).toBe(id);
		const [autre] = await base.insert(personne).values({ email: 'z@exemple.fr', prenom: 'Zoé', nom: 'Test' }).returning();
		await expect(ouvrir({ type: 'personne', id: autre!.id }, id)).rejects.toMatchObject({ status: 404 });
		await expect(ouvrir(alice, 'abc')).rejects.toMatchObject({ status: 404 });
		expect((await ouvrir(chef, id)).demande).toMatchObject({ gestes: ['prendre', 'question', 'avancer', 'refuser'], icone: 'croix' });
	});

	it('les gestes par le formulaire : prendre, question, réponse, avancer, finir ; refus lisibles', async () => {
		const { alice, referent, demander, geste, ouvrir, commandee } = await jeu();
		const id = await idDe(demander(alice, 'Compresses'));
		expect(await geste(referent, id, [['quoi', 'prendre']])).toEqual({ quoi: 'prendre', succes: 'Vous l’avez prise en compte.' });
		expect(await geste(referent, id, [['quoi', 'question'], ['texte', '']])).toMatchObject({ status: 400, data: { quoi: 'question', message: 'Écrivez votre message.' } });
		await geste(referent, id, [['quoi', 'question'], ['texte', 'Quelle taille ?']]);
		await geste(alice, id, [['quoi', 'repondre'], ['texte', '10 x 10']]);
		expect(await geste(referent, id, [['quoi', 'avancer'], ['vers', 'prise'], ['texte', '']])).toMatchObject({ status: 400, data: { message: 'Choisissez une étape placée après l’étape actuelle.' } });
		await geste(referent, id, [['quoi', 'avancer'], ['vers', commandee], ['texte', '']]);
		expect(await geste(referent, id, [['quoi', 'refuser'], ['texte', '']])).toMatchObject({ status: 400, data: { message: 'Expliquez le refus en un mot. L’agent le lira.' } });
		expect(await geste(referent, id, [['quoi', 'avancer'], ['vers', 'faite'], ['texte', 'Dans votre casier']])).toMatchObject({ succes: 'Étape enregistrée.' });
		expect((await ouvrir(alice, id)).demande).toMatchObject({ etape: 'faite', nomEtape: 'Livrée', mot: 'Dans votre casier' });
		expect(await geste(alice, id, [['quoi', 'annuler']])).toMatchObject({ status: 400, data: { message: 'Ce geste n’est plus possible. La demande a avancé.' } });
		expect(await geste(alice, id, [['quoi', 'nimporte']])).toMatchObject({ status: 400, data: { quoi: null } });
		await expect(geste({ type: 'personne', id: 9999 }, id, [['quoi', 'prendre']])).rejects.toMatchObject({ status: 404 });
	});
});
