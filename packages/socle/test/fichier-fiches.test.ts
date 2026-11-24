import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { DonneeInvalide, RefusDroit } from '../src/erreurs.ts';
import { apercuFiches, appliquerFiches, donneesFichierFiches, type FichierFichesLu } from '../src/fichier-fiches.ts';
import { lireFiche, reglerPrevenir } from '../src/fiches.ts';
import { ficheVersion, responsabilite } from '../src/schema.ts';
import { jeuEngins, maintenant } from './de-test-engins.ts';

const ENTETES = ['Réf.', 'Zone', 'Élément', 'Quantité', 'Prévenir'];
// `entetes` : celles du fichier (un ancien fichier n'a pas « Prévenir »).
const lu = (feuilles: Record<string, string[][]>, entetes = ENTETES): FichierFichesLu => ({
	feuilles: Object.fromEntries(Object.entries(feuilles).map(([nom, lignes]) => [nom, lignes.map((cellules, i) => ({ numero: i + 2, cellules }))])),
	entetes: Object.fromEntries(Object.keys(feuilles).map((nom) => [nom, entetes]))
});

async function avecExport() {
	const jeu = await jeuEngins();
	const donnees = await donneesFichierFiches(jeu.base, jeu.referent, maintenant);
	const feuille = (nom: string) => donnees.feuilles.find((f) => f.nom === nom)!.lignes.map((l) => [...l]);
	return { ...jeu, donnees, feuille };
}

describe('fichier des fiches', () => {
	it('exporte une feuille par type, une ligne par élément, dans l’ordre de la fiche', async () => {
		const { donnees, feuille } = await avecExport();
		expect(donnees.entetes).toEqual(ENTETES);
		expect(donnees.feuilles.map((f) => [f.nom, f.lignes.length])).toEqual([['VSAV', 33], ['FPT', 24], ['VTU', 15]]);
		expect(feuille('VTU')[3]).toEqual(['61', 'Cabine', 'Gilets haute visibilité', '3', '']);
		expect(feuille('VTU')[4]).toEqual(['62', 'Épuisement', 'Motopompe (plein et essai)', '', '']);
	});

	it('réservé à qui gère les engins', async () => {
		const { base, alice } = await jeuEngins();
		await expect(donneesFichierFiches(base, alice, maintenant)).rejects.toBeInstanceOf(RefusDroit);
		await expect(apercuFiches(base, alice, lu({}), maintenant)).rejects.toBeInstanceOf(RefusDroit);
	});

	it('réimporté tel quel : aucun changement, rien d’écrit', async () => {
		const { base, referent, feuille } = await avecExport();
		const fichier = lu({ VSAV: feuille('VSAV'), FPT: feuille('FPT'), VTU: feuille('VTU') });
		const apercu = await apercuFiches(base, referent, fichier, maintenant);
		expect(apercu.erreurs).toEqual([]);
		expect(apercu.fiches.every((f) => !f.ajoutes.length && !f.retires.length && !f.modifies.length && !f.ordre)).toBe(true);
		await appliquerFiches(base, referent, fichier, maintenant);
		expect((await lireFiche(base, (await jeuEngins()).types.VTU)).version.creeLe).not.toBe(maintenant);
	});

	it('aperçu puis application : ajout sans Réf., retrait, libellé, quantité et zone changés ; les autres fiches ne bougent pas', async () => {
		const { base, referent, types, feuille } = await avecExport();
		const vtu = feuille('VTU');
		vtu[0]![2] = 'Carburant (au moins 3/4)';
		vtu[3]![3] = '4';
		vtu[5]![1] = 'Coffres';
		vtu.splice(6, 1);
		vtu.push(['', 'Toit', 'Échelle de toit', '']);
		const fichier = lu({ VTU: vtu });
		const apercu = await apercuFiches(base, referent, fichier, maintenant);
		expect(apercu).toEqual({
			erreurs: [],
			fiches: [
				{
					type: 'VTU',
					version: 1,
					nouvelleVersion: false,
					ajoutes: ['Échelle de toit'],
					retires: ['Aspirateur à eau'],
					modifies: ['Niveau de carburant (au moins 3/4) renommé en Carburant (au moins 3/4)', 'Gilets haute visibilité, 4 au lieu de 3', 'Électropompe (passe en Coffres)'],
					prevenir: [],
					ordre: false
				}
			]
		});
		await appliquerFiches(base, referent, fichier, maintenant);
		const fiche = await lireFiche(base, types.VTU);
		expect(fiche.zones.map((z) => z.nom)).toEqual(['Cabine', 'Épuisement', 'Coffres', 'Toit']);
		expect(fiche.zones[0]!.elements[0]).toEqual({ ref: 58, libelle: 'Carburant (au moins 3/4)', quantite: null });
		expect(fiche.zones.map((z) => z.prevenir)).toEqual([[], [], [], []]);
		expect(fiche.zones[3]!.elements[0]!.ref).toBe(73);
		expect(fiche.version).toMatchObject({ numero: 1, creeLe: maintenant });
		expect((await lireFiche(base, types.VSAV)).version.creeLe).not.toBe(maintenant);
	});

	it('une fiche déjà utilisée reçoit une nouvelle version', async () => {
		const { base, referent, types, feuille } = await avecExport();
		await base.update(ficheVersion).set({ utilisee: 1 }).where(eq(ficheVersion.typeId, types.FPT));
		const fpt = feuille('FPT');
		fpt.pop();
		const apercu = await apercuFiches(base, referent, lu({ FPT: fpt }), maintenant);
		expect(apercu.fiches[0]).toMatchObject({ nouvelleVersion: true, retires: ['Tronçonneuse (plein et essai)'] });
		await appliquerFiches(base, referent, lu({ FPT: fpt }), maintenant);
		expect((await lireFiche(base, types.FPT)).version.numero).toBe(2);
	});

	it('signale les erreurs ligne par ligne et n’applique rien', async () => {
		const { base, referent, types, feuille } = await avecExport();
		const vtu = feuille('VTU');
		vtu[0]![3] = 'deux';
		vtu[1]![1] = '';
		vtu[2]![0] = vtu[3]![0]!;
		const fichier = lu({ VTU: vtu, CCF: [['', 'Cabine', 'Radio', '']], FPT: [] });
		const { erreurs } = await apercuFiches(base, referent, fichier, maintenant);
		expect(erreurs).toEqual([
			{ feuille: 'VTU', ligne: 2, message: 'Quantité « deux » invalide. Écrivez un nombre entier de 1 à 999, ou rien' },
			{ feuille: 'VTU', ligne: 3, message: 'Zone vide' },
			{ feuille: 'VTU', ligne: 5, message: 'Réf. 61 en double. Effacez-la sur la copie' },
			{ feuille: 'CCF', ligne: 1, message: 'Type d’engin « CCF » inconnu. Créez-le d’abord dans l’appli, depuis Fiches puis Nouveau type.' },
			{ feuille: 'FPT', ligne: 2, message: 'Feuille vide. Une fiche garde au moins un élément (retirez la feuille pour ne pas toucher à cette fiche)' }
		]);
		await expect(appliquerFiches(base, referent, fichier, maintenant)).rejects.toThrow(new DonneeInvalide('Le fichier contient des erreurs'));
		expect((await lireFiche(base, types.VTU)).version.creeLe).not.toBe(maintenant);
	});

	it('refuse deux feuilles pour un même type', async () => {
		const { base, referent, feuille } = await avecExport();
		const { erreurs } = await apercuFiches(base, referent, lu({ VTU: feuille('VTU'), vtu: feuille('VTU') }), maintenant);
		expect(erreurs).toEqual([{ feuille: 'vtu', ligne: 1, message: 'Deux feuilles pour le type VTU' }]);
	});

	it('refuse des colonnes déplacées', async () => {
		const { base, referent, feuille } = await avecExport();
		const fichier = { ...lu({ VTU: feuille('VTU') }), entetes: { VTU: ['Zone', 'Réf.', 'Élément', 'Quantité'] } };
		expect((await apercuFiches(base, referent, fichier, maintenant)).erreurs).toEqual([{ feuille: 'VTU', ligne: 1, message: 'Colonnes attendues, dans l’ordre : Réf., Zone, Élément, Quantité' }]);
	});

	describe('la colonne Prévenir', () => {
		const roleNomme = async (base: Awaited<ReturnType<typeof jeuEngins>>['base'], nom: string) => (await base.select().from(responsabilite).where(eq(responsabilite.nom, nom)))[0]!.id;
		// Les lignes de la zone Cabine du VTU reçoivent `valeur` dans la colonne Prévenir.
		const avecCabine = (lignes: string[][], valeur: string) => lignes.map((l) => (l[1] === 'Cabine' ? [...l.slice(0, 4), valeur] : l));

		it('exportée avec les noms des rôles ; réimportée telle quelle, rien ne change', async () => {
			const { base, referent, types } = await jeuEngins();
			const zone = (await lireFiche(base, types.VTU)).zones[0]!.ref;
			await reglerPrevenir(base, referent, types.VTU, zone, [await roleNomme(base, 'Référent pharmacie'), await roleNomme(base, 'Référent engins')], maintenant);
			const donnees = await donneesFichierFiches(base, referent, maintenant);
			const vtu = donnees.feuilles.find((f) => f.nom === 'VTU')!.lignes;
			expect(vtu[0]![4]).toBe('Référent pharmacie, Référent engins');
			expect(vtu.at(-1)![4]).toBe('');
			const apercu = await apercuFiches(base, referent, lu({ VTU: vtu }), maintenant);
			expect(apercu).toMatchObject({ erreurs: [], fiches: [{ ajoutes: [], retires: [], modifies: [], prevenir: [], ordre: false }] });
		});

		it('réglée par le fichier, sans version de plus ; la casse et les espaces ne comptent pas ; vide, plus de réglage', async () => {
			const { base, referent, types, feuille } = await avecExport();
			await base.update(ficheVersion).set({ utilisee: 1 }).where(eq(ficheVersion.typeId, types.VTU));
			const pharmacie = await roleNomme(base, 'Référent pharmacie');
			// Une seule ligne de la zone suffit.
			const vtu = feuille('VTU');
			vtu[1] = [...vtu[1]!.slice(0, 4), ' référent PHARMACIE '];
			const apercu = await apercuFiches(base, referent, lu({ VTU: vtu }), maintenant);
			expect(apercu).toMatchObject({ erreurs: [], fiches: [{ nouvelleVersion: false, ajoutes: [], retires: [], modifies: [], prevenir: ['Cabine, prévient Référent pharmacie'] }] });
			await appliquerFiches(base, referent, lu({ VTU: vtu }), maintenant);
			const fiche = await lireFiche(base, types.VTU);
			expect(fiche.version.numero).toBe(1);
			expect(fiche.zones[0]!.prevenir).toEqual([pharmacie]);
			expect(fiche.zones[1]!.prevenir).toEqual([]);
			// La colonne vide : la règle d'aujourd'hui.
			expect((await apercuFiches(base, referent, lu({ VTU: feuille('VTU') }), maintenant)).fiches[0]!.prevenir).toEqual(['Cabine, prévient ceux qui traitent les anomalies']);
			await appliquerFiches(base, referent, lu({ VTU: feuille('VTU') }), maintenant);
			expect((await lireFiche(base, types.VTU)).zones[0]!.prevenir).toEqual([]);
		});

		it('un fichier sans la colonne garde les réglages, même avec un autre changement', async () => {
			const { base, referent, types, feuille } = await avecExport();
			const pharmacie = await roleNomme(base, 'Référent pharmacie');
			const zone = (await lireFiche(base, types.VTU)).zones[0]!.ref;
			await reglerPrevenir(base, referent, types.VTU, zone, [pharmacie], maintenant);
			const ancien = feuille('VTU').map((l) => l.slice(0, 4));
			ancien[0]![2] = 'Carburant';
			const apercu = await apercuFiches(base, referent, lu({ VTU: ancien }, ENTETES.slice(0, 4)), maintenant);
			expect(apercu).toMatchObject({ erreurs: [], fiches: [{ prevenir: [], modifies: [expect.stringContaining('Carburant')] }] });
			await appliquerFiches(base, referent, lu({ VTU: ancien }, ENTETES.slice(0, 4)), maintenant);
			expect((await lireFiche(base, types.VTU)).zones[0]!.prevenir).toEqual([pharmacie]);
		});

		it('refuse un rôle inconnu ou deux réglages différents pour une zone, avec la ligne', async () => {
			const { base, referent, feuille } = await avecExport();
			const vtu = avecCabine(feuille('VTU'), 'Référent pharmacie');
			vtu[1]![4] = 'Référent engins';
			vtu[5]![4] = 'Référent pharmacie, Pompier volant';
			const { erreurs } = await apercuFiches(base, referent, lu({ VTU: vtu }), maintenant);
			expect(erreurs).toEqual([
				{ feuille: 'VTU', ligne: 3, message: 'Prévenir n’est pas le même que sur les autres lignes de la zone Cabine. Écrivez les mêmes rôles sur chacune, ou sur une seule' },
				{ feuille: 'VTU', ligne: 7, message: 'Rôle « Pompier volant » inconnu. Écrivez le nom d’un rôle du centre, comme dans Réglages, puis Rôles' }
			]);
		});
	});
});
