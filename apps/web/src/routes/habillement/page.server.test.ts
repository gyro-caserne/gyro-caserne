import { eq } from 'drizzle-orm';
import { archiverResponsabilite, demandeReferent, responsabilite } from '@gyro-caserne/socle';
import { describe, expect, it } from 'vitest';
import { locaux, preparer } from '../echanges/de-test.ts';
import { load } from './+page.server';
import { load as ancienne } from './[id]/+page.server';

/* eslint-disable @typescript-eslint/no-explicit-any */
const vers = async (promesse: Promise<unknown>) => {
	const r = (await promesse.catch((e) => e)) as { status: number; location: string };
	expect(r.status).toBe(303);
	return r.location;
};

describe('/habillement, l’ancienne entrée', () => {
	it('mène à « Faire une demande », le référent habillement déjà choisi ; demande la connexion', async () => {
		const { base, alice } = await preparer();
		const [r] = await base.select().from(responsabilite).where(eq(responsabilite.nom, 'Référent habillement'));
		expect(await vers((load as any)({ locals: locaux(base, alice) }))).toBe(`/demandes?role=${r!.id}`);
		expect(await vers((load as any)({ locals: locaux(base, null) }))).toBe('/connexion');
		// Le rôle ne reçoit plus de demandes : « Faire une demande », sans rôle choisi.
		await archiverResponsabilite(base, { type: 'super', email: 'a@b.fr' }, r!.id, '2026-11-23');
		expect(await vers((load as any)({ locals: locaux(base, alice) }))).toBe('/demandes');
	});

	it('une ancienne adresse de demande mène à la demande reprise, sinon à « Mes demandes »', async () => {
		const { base, alice } = await preparer();
		const [r] = await base.select().from(responsabilite).where(eq(responsabilite.nom, 'Référent habillement'));
		const [d] = await base.insert(demandeReferent).values({ responsabiliteId: r!.id, demandeurId: alice.id, texte: 'Veste', creeLe: '2026-11-01T10:00', majLe: '2026-11-01T10:00', habillementId: 12 }).returning();
		const ouvrir = (acteur: unknown, id: string) => vers((ancienne as any)({ locals: locaux(base, acteur), params: { id } }));
		expect(await ouvrir(alice, '12')).toBe(`/demandes/${d!.id}`);
		expect(await ouvrir(alice, '13')).toBe('/demandes');
		expect(await ouvrir(alice, 'toutes')).toBe('/demandes');
		expect(await ouvrir(null, '12')).toBe('/connexion');
	});
});
