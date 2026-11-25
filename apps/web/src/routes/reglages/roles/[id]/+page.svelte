<script lang="ts">
	import EnTetePage from '#lib/ui/EnTetePage.svelte';
	import { onMount, tick, untrack } from 'svelte';
	import { estDroitDuCentre, estDroitPouvoir, estSansEffet, iconeDuRole, type Droit } from '@gyro-caserne/socle';
	import { LIBELLES_DROIT } from '#lib/droits.ts';
	import { ADMINISTRATION, appliquerNiveaux, DOMAINES, estPersonnalise, niveauxDe, type DomaineId } from '#lib/paquets.ts';
	import BarreActions from '#lib/ui/BarreActions.svelte';
	import Bouton from '#lib/ui/Bouton.svelte';
	import Champ from '#lib/ui/Champ.svelte';
	import Choix from '#lib/ui/Choix.svelte';
	import ChoixRadio from '#lib/ui/ChoixRadio.svelte';
	import Interrupteur from '#lib/ui/Interrupteur.svelte';
	import Groupe from '#lib/ui/Groupe.svelte';
	import IconeRole from '#lib/ui/IconeRole.svelte';
	import Pastille from '#lib/ui/Pastille.svelte';
	import ReglageEtapes from '#lib/demandes/ReglageEtapes.svelte';
	import BlocTitulaires from '#lib/nommer/BlocTitulaires.svelte';
	import { resume } from '#lib/nommer/postes.ts';
	import { pluriel } from '#lib/pluriel.ts';
	import ChoixIcone from '../../ChoixIcone.svelte';
	import Domaines from '../../Domaines.svelte';
	import { NOMS_ICONES, optionsAttributeur, quiAttribue, TENU_POUR, tenuPour, TOUJOURS_TENU, valeurAttributeur } from '../../roles.ts';

	let { data, form } = $props();

	const role = $derived(data.role);
	const actuels = $derived(role.droits.map((d) => d.droit as Droit));
	const lectureSeule = $derived(data.raison !== null);
	const peutAdmin = $derived(data.peutPouvoir && !lectureSeule);

	const adminDe = (droits: Droit[]) => droits.filter(estDroitPouvoir);
	const RESERVE_AU_CENTRE = 'Gérer les accès, les comités et les rôles est réservé à un rôle tenu pour tout le centre.';

	// Après un refus, la saisie revient du serveur : on la réaffiche.
	const saisis = $derived(form?.cible === 'role' && !form?.succes ? form?.valeurs : undefined);
	function choixDepart() {
		const c = niveauxDe(actuels);
		for (const d of DOMAINES) {
			const n = Number((saisis as { niveaux?: Record<string, string> } | undefined)?.niveaux?.[d.id] ?? NaN);
			if (Number.isInteger(n) && n >= 0 && n < d.niveaux.length) c[d.id] = n;
		}
		return c;
	}
	const adminDepart = () => (saisis?.admin ? adminDe(saisis.admin as Droit[]) : adminDe(actuels));

	// Ce qui est choisi à l'écran, pas encore enregistré. Repart de la page à chaque chargement (autre rôle, envoi).
	let choix = $state(untrack(choixDepart));
	let admin = $state(untrack(adminDepart));
	// La portée choisie à l'écran. Sans JavaScript, celle de la page : le refus du serveur reste le filet.
	const porteeDepart = () => (saisis?.portee as string | undefined) || role.portee;
	let portee = $state(untrack(porteeDepart));
	$effect.pre(() => {
		choix = choixDepart();
		admin = adminDepart();
		portee = porteeDepart();
		toujours = saisie('nature', role.nature) === 'fonction';
	});

	// Hors du centre, ces droits sont grisés et décochés : une case grisée n'est pas envoyée, le droit part à l'enregistrement.
	const portePasCentre = $derived(portee !== 'centre');
	const adminPermis = $derived(portePasCentre ? admin.filter((d) => !estDroitDuCentre(d)) : admin);
	// Le détail s'enregistre seul, avec la portée déjà enregistrée : il suit celle-ci, pas celle de l'écran.
	const detailPasCentre = $derived(role.portee !== 'centre');

	const departNiveaux = $derived(niveauxDe(actuels));
	const departAdmin = $derived(adminDe(actuels));
	const memes = (a: Droit[], b: Droit[]) => a.length === b.length && a.every((d) => b.includes(d));
	const modifies = $derived(DOMAINES.filter((d) => choix[d.id] !== departNiveaux[d.id]).length + (memes(adminPermis, departAdmin) ? 0 : 1));
	const message = $derived(modifies === 0 ? '' : modifies === 1 ? '1 domaine modifié, pas encore enregistré' : `${modifies} domaines modifiés, pas encore enregistrés`);

	const numeriques = $derived(Object.fromEntries(Object.entries(choix).filter(([, n]) => typeof n === 'number')) as Partial<Record<DomaineId, number>>);
	const apres = $derived([...appliquerNiveaux(actuels, numeriques).filter((d) => !estDroitPouvoir(d)), ...adminPermis]);
	const personnalise = $derived(estPersonnalise(apres, role.modele));

	function toutRevenir(e: Event) {
		e.preventDefault();
		if (!data.modele) return;
		choix = niveauxDe(data.modele.droits);
		if (peutAdmin) admin = adminDe(data.modele.droits);
	}

	const concerne = (cible: string) => form?.cible === cible;
	// Le réglage des demandes : la saisie renvoyée par le serveur (aperçu ou refus), sinon celui du rôle (ou celui gardé au décochage).
	const saisieDemandes = $derived(
		form?.demandes ?? { recoit: role.demandes !== null, etapes: (role.demandes ?? role.demandesGardees)?.etapes ?? [], derniere: (role.demandes ?? role.demandesGardees)?.derniere ?? 'Faite' }
	);
	// Un bloc s'ouvre seulement s'il est visé ; sinon aucun attribut open n'est posé, et l'hydratation ne referme pas ce que l'agent a ouvert.
	const ouvert = (cible: string) => (concerne(cible) && !form?.succes ? { open: true } : {});
	const erreurs = (cible: string): Record<string, string> => (concerne(cible) ? (form?.erreurs ?? {}) : {});
	const saisie = (champ: 'nom' | 'nature' | 'attributeur', defaut: string) => (concerne('role') ? (form?.valeurs?.[champ] ?? defaut) : defaut);
	// L'identité s'ouvre d'emblée à l'ordinateur, comme les domaines, et partout après un refus de l'enregistrement.
	let identiteOuverte = $state(untrack(() => concerne('role') && !form?.succes));
	// L'interrupteur à l'écran : le résumé de l'identité le suit avant l'enregistrement.
	let toujours = $state(untrack(() => saisie('nature', role.nature) === 'fonction'));
	// « Archiver le rôle » déplie sa confirmation sur place ; sans JavaScript, un repli simple.
	let monte = $state(false);
	let archivage = $state(untrack(() => concerne('archiver') && !form?.succes));
	onMount(() => {
		monte = true;
		// On ouvre, on ne referme jamais ce qui est ouvert.
		if (matchMedia('(min-width: 1024px)').matches) identiteOuverte = true;
	});
	async function basculerArchivage() {
		archivage = !archivage;
		if (!archivage) return;
		await tick();
		document.querySelector<HTMLInputElement>('#archiver input[name="confirmation"]')?.focus();
	}
	const nommePar = $derived(optionsAttributeur(data.comitesChoix).find((o) => o.valeur === valeurAttributeur(role.attributeur))?.libelle ?? 'Le chef de centre');
	const blocTitulaires = $derived(data.titulairesDuRole);
	const resumeTitulaires = $derived(blocTitulaires ? resume(pluriel(blocTitulaires.postes.reduce((n, p) => n + p.titulaires.length, 0), 'titulaire'), blocTitulaires.postes) : '');
	const avertissement = (n: number) =>
		n === 0 ? 'Personne ne tient ce rôle aujourd’hui.' : n === 1 ? 'La personne qui tient ce rôle le perd aujourd’hui, avec ses droits.' : `Les ${n} personnes qui tiennent ce rôle le perdent aujourd’hui, avec ses droits.`;
</script>

<svelte:head>
	<title>{role.nom}</title>
</svelte:head>

{#snippet retour(cible: string)}
	<!-- Les deux zones lues ensemble : vides, elles ne prennent qu'un écart de la page. -->
	<div class="retours">
	<div role="alert">
		{#if concerne(cible) && (form?.message || form?.erreurs)}<p class="echec">{form?.message ?? 'Le formulaire contient des erreurs.'}</p>{/if}
	</div>
	<div role="status">
		{#if concerne(cible) && form?.succes}<p class="succes">{form.succes}</p>{/if}
	</div>
	</div>
{/snippet}

<div class="en-tete-role">
	<EnTetePage titre={role.nom} phrase="{tenuPour(role.portee)}, {quiAttribue(role.attributeur, data.comitesChoix)}">
		{#snippet tete()}<IconeRole icone={iconeDuRole(role)} taille={48} />{/snippet}
	</EnTetePage>
	{#if data.modele}<p class="aide">Créé à partir du modèle {data.modele.nom}</p>{/if}
	<div class="pastilles">
		{#if personnalise}<Pastille ton="alerte">Personnalisé</Pastille>{/if}
		{#if role.systeme !== null}<Pastille ton="neutre">Rôle système</Pastille>{/if}
		{#if role.archiveeLe !== null}<Pastille ton="neutre">Archivé</Pastille>{/if}
	</div>
</div>

{#if blocTitulaires}
	<BlocTitulaires
		postes={blocTitulaires.postes}
		role={role.nom}
		resume={resumeTitulaires}
		question={data.nouveau ? 'Qui le tiendra ?' : undefined}
		gestes={blocTitulaires.gestes}
		aujourdhui={data.aujourdhui}
		fiches={blocTitulaires.fiches}
		prevenu={data.prevenuPour?.length ? `Prévenu pour ${data.prevenuPour.map((z) => `${z.zone} (${z.types.join(', ')})`).join(', ')}` : undefined}
		{form}
	/>
{/if}

{#if data.raison}<p class="raison">{data.raison}</p>{/if}
{@render retour('role')}

<svelte:element this={lectureSeule ? 'div' : 'form'} class="formulaire" {...lectureSeule ? {} : { method: 'POST', action: '?/enregistrer', id: 'role' }}>
	{#if !lectureSeule}
		<Groupe titre="Identité" resume={toujours ? 'Doit toujours être tenu' : 'Peut rester sans titulaire'} bind:ouvert={identiteOuverte}>
			<div class="champs">
				<Champ id="role-nom" name="nom" libelle="Nom" requis maxlength={60} valeur={saisie('nom', role.nom)} erreur={erreurs('role').nom} />
				<Interrupteur libelle={TOUJOURS_TENU.libelle} description={TOUJOURS_TENU.description} nom="toujours" bind:coche={toujours} />
				{#if role.titulaires > 0}
					<p class="aide">{tenuPour(role.portee)}. Ne change pas tant que le rôle a un titulaire.</p>
				{:else}
					<ChoixRadio id="role-portee" legende="Tenu pour" name="portee" disposition="rangees" bind:valeur={portee} erreur={erreurs('role').portee} options={TENU_POUR} />
				{/if}
				<Choix id="role-attributeur" name="attributeur" libelle="Qui nomme" valeur={saisie('attributeur', valeurAttributeur(role.attributeur))} erreur={erreurs('role').attributeur} options={optionsAttributeur(data.comitesChoix)} />
				{#key role.id}<ChoixIcone valeur={(saisis?.icone as ReturnType<typeof iconeDuRole> | undefined) ?? iconeDuRole(role)} erreur={erreurs('role').icone} />{/key}
			</div>
		</Groupe>
	{:else}
		<!-- Rôle système ou archivé : l'identité se lit, sans geste. -->
		<Groupe titre="Identité" resume={role.nature === 'fonction' ? 'Doit toujours être tenu' : 'Peut rester sans titulaire'}>
			<dl class="identite">
				<div><dt>Tenu pour</dt><dd>{TENU_POUR.find((t) => t.valeur === role.portee)?.libelle ?? role.portee}</dd></div>
				<div><dt>Qui nomme</dt><dd>{nommePar}</dd></div>
				<div><dt>Icône</dt><dd class="icone"><IconeRole icone={iconeDuRole(role)} taille={28} />{NOMS_ICONES[iconeDuRole(role)]}</dd></div>
			</dl>
		</Groupe>
	{/if}

	<div class="section">
		<h2 class="titre-groupe">Ce qu’il peut faire</h2>
		<p class="aide">En plus de ce que tout agent fait déjà.</p>
	</div>
	<Domaines droits={actuels} modele={data.modele?.droits ?? null} bind:choix {lectureSeule} formRevenir="revenir" niveauTitre={3} />

	<Groupe titre="Administration de l’appli" niveauTitre={3} resume={adminPermis.length === 0 ? 'Aucun pouvoir' : adminPermis.map((d) => ADMINISTRATION.find((a) => a.droit === d)?.libelle).join(', ')}>
		<fieldset class="admin" aria-describedby={peutAdmin ? undefined : 'admin-aide'}>
			<legend class="cache">Administration de l’appli</legend>
			<!-- Grisées pour l'une de deux raisons : le rôle est figé, ou la personne ne gère pas le pouvoir. -->
			{#if !peutAdmin}
				<p id="admin-aide" class="aide">{lectureSeule ? 'Ces cases ne se modifient pas sur ce rôle.' : 'Seuls le chef de centre, son adjoint et le super administrateur cochent ou décochent ces cases.'}</p>
			{:else}
				<input type="hidden" name="administration" value="oui" />
			{/if}
			{#if portePasCentre}<p id="admin-centre" class="aide">{RESERVE_AU_CENTRE}</p>{/if}
			{#each ADMINISTRATION as a (a.droit)}
				{@const reserve = portePasCentre && estDroitDuCentre(a.droit)}
				<label class="case"
					><input
						type="checkbox"
						name="admin"
						value={a.droit}
						checked={adminPermis.includes(a.droit)}
						disabled={!peutAdmin || reserve}
						aria-describedby={reserve ? 'admin-centre' : undefined}
						onchange={(e) => (admin = e.currentTarget.checked ? [...admin, a.droit] : admin.filter((d) => d !== a.droit))}
					/>
					{a.libelle}</label
				>
			{/each}
		</fieldset>
	</Groupe>

	{#if !lectureSeule}
		{#if data.demandesPossibles}
			<!-- Enregistré avec le reste par « Enregistrer » ; ouvert quand la page revient avec sa saisie. -->
			<details class="pli repli" {...form?.demandes ? { open: true } : {}}>
				<summary>Demandes</summary>
				<ReglageEtapes saisie={saisieDemandes} peutCocher apercu="?/apercu" />
			</details>
		{/if}

		<BarreActions {message}>
			<Bouton type="submit">Enregistrer</Bouton>
			{#if data.modele}
				<button type="submit" class="secondaire" form="revenir" name="domaine" value="tout" onclick={toutRevenir}>↺ Tout revenir</button>
			{/if}
		</BarreActions>
	{/if}
</svelte:element>

<!-- Sans JavaScript, « Revenir au modèle » et « Tout revenir » envoient ce formulaire. -->
{#if !lectureSeule}<form id="revenir" method="POST" action="?/revenir"></form>{/if}

<!-- En bas de page, les deux gestes rares. -->
<div class="bas">
	<details class="pli repli" {...ouvert('detail')}>
		<summary>Détail droit par droit</summary>
		{@render retour('detail')}
		{#if lectureSeule}
			<ul class="detail">
				{#each actuels.filter((d) => !estSansEffet(d)) as d (d)}<li>{LIBELLES_DROIT[d]}</li>{:else}<li>Aucun droit en plus de ceux de tout agent.</li>{/each}
			</ul>
		{:else}
			<form method="POST" action="?/detail" class="formulaire-detail">
				{#each [{ titre: 'Droits métier', liste: data.droitsMetier, pouvoir: false }, { titre: 'Droits d’administration', liste: data.droitsPouvoir, pouvoir: true }] as bloc (bloc.titre)}
					<fieldset>
						<legend>{bloc.titre}</legend>
						{#if bloc.pouvoir && detailPasCentre}<p id="detail-centre" class="aide">{RESERVE_AU_CENTRE}</p>{/if}
						{#each bloc.liste as d (d)}
							{@const verrouille = role.droits.some((x) => x.droit === d && x.verrouille)}
							{@const reserve = detailPasCentre && estDroitDuCentre(d)}
							<label class="case"
								><input type="checkbox" name="droits" value={d} checked={actuels.includes(d) && !reserve} disabled={verrouille || reserve || (bloc.pouvoir && !data.peutPouvoir)} aria-describedby={reserve ? 'detail-centre' : undefined} />
								{LIBELLES_DROIT[d]}</label
							>
						{/each}
					</fieldset>
				{/each}
				<Bouton type="submit" variante="secondaire">Enregistrer le détail</Bouton>
			</form>
		{/if}
	</details>

	{#if !lectureSeule}
		{#snippet confirmerArchivage()}
			<form id="archiver" method="POST" action="?/archiver" class="formulaire-detail confirmation" hidden={monte && !archivage}>
				{@render retour('archiver')}
				<p class="avertissement">{avertissement(role.titulaires)}</p>
				<label class="case"><input type="checkbox" name="confirmation" value="oui" /> Je confirme</label>
				<Bouton type="submit" variante="grave">Confirmer l’archivage</Bouton>
			</form>
		{/snippet}
		{#if monte}
			<div class="archiver">
				<div><Bouton variante="grave" etendu={archivage} controle="archiver" onclick={basculerArchivage}>Archiver le rôle</Bouton></div>
				{@render confirmerArchivage()}
			</div>
		{:else}
			<details class="repli archiver" {...ouvert('archiver')}>
				<summary>Archiver le rôle</summary>
				{@render confirmerArchivage()}
			</details>
		{/if}
	{/if}
</div>

<style>
	.en-tete-role {
		display: flex;
		flex-direction: column;
		gap: var(--espace-8);
	}
	p {
		margin: 0;
	}
	.aide {
		color: var(--doux);
	}
	.pastilles {
		display: flex;
		flex-wrap: wrap;
		gap: var(--espace-6);
	}
	.raison {
		padding: var(--espace-12) var(--espace-16);
		border-radius: var(--rayon-petit);
		background: var(--statut-neutre-fond);
		border: 1px solid var(--statut-neutre-trait);
	}
	.formulaire,
	.bas {
		display: flex;
		flex-direction: column;
		gap: var(--espace-12);
	}
	.section {
		display: flex;
		flex-direction: column;
		gap: var(--espace-4);
		margin-top: var(--espace-12);
	}
	.bas {
		margin-top: var(--espace-8);
	}
	.identite {
		margin: 0;
		padding: var(--espace-12) var(--espace-16) var(--espace-16);
		display: flex;
		flex-direction: column;
		gap: var(--espace-12);
	}
	dt {
		font-weight: 600;
	}
	dd {
		margin: 0;
		color: var(--doux);
	}
	dd.icone {
		display: flex;
		align-items: center;
		gap: var(--espace-8);
	}
	.retours {
		display: flex;
		flex-direction: column;
	}
	/* La confirmation de l'archivage : une carte, sous son bouton. */
	.confirmation {
		padding: var(--espace-16);
		background: var(--surface);
		border: 1px solid transparent;
		box-shadow: var(--ombre-carte);
		border-radius: var(--rayon-grand);
	}
	.archiver {
		display: flex;
		flex-direction: column;
		gap: var(--espace-12);
	}
	.archiver > summary {
		color: var(--accent);
	}
	.admin,
	fieldset {
		border: none;
		margin: 0;
		padding: var(--espace-12) var(--espace-16);
	}
	.cache {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}
	.champs {
		padding: var(--espace-12) var(--espace-16) var(--espace-16);
		display: flex;
		flex-direction: column;
		gap: var(--espace-16);
	}
	.case {
		display: flex;
		align-items: center;
		gap: var(--espace-12);
		min-height: var(--cible);
	}
	.secondaire {
		min-height: var(--cible);
		padding: 0 var(--espace-20);
		border-radius: var(--rayon-petit);
		border: 2px solid var(--doux);
		background: var(--surface);
		color: var(--encre);
		font: 700 var(--texte-16) var(--police);
		cursor: pointer;
	}
	.pli {
		background: var(--surface);
		border: 1px solid transparent;
		box-shadow: var(--ombre-carte);
		border-radius: var(--rayon-grand);
		padding: 0 var(--espace-16);
	}
	summary {
		min-height: 56px;
		display: flex;
		align-items: center;
		font-weight: 600;
		cursor: pointer;
	}
	.formulaire-detail {
		display: flex;
		flex-direction: column;
		gap: var(--espace-12);
		padding-bottom: var(--espace-16);
	}
	.formulaire-detail[hidden] {
		display: none;
	}
	.formulaire-detail > :global(button) {
		align-self: flex-start;
	}
	legend {
		font-weight: 700;
	}
	.detail {
		margin: 0 0 var(--espace-16);
	}
	.avertissement {
		font-weight: 600;
	}
	.echec,
	.succes {
		padding: var(--espace-12) var(--espace-16);
		border-radius: var(--rayon-petit);
		border: 2px solid var(--accent);
		font-weight: 600;
	}
	.succes {
		border-color: var(--ok);
	}
</style>
