<script lang="ts">
	import { enhance } from '$app/forms';
	import { ajouterJours } from '@gyro-caserne/socle/dates';
	import { dateCourte } from '#lib/engins/textes.ts';
	import Panneau from '#lib/planning/Panneau.svelte';
	import Bouton from '#lib/ui/Bouton.svelte';
	import Champ from '#lib/ui/Champ.svelte';
	import Choix from '#lib/ui/Choix.svelte';
	import { onMount, untrack } from 'svelte';
	import { agentsPour, intitule, simple, type Agent, type Poste } from './postes.ts';
	import { surEnvoi } from './envoi.svelte.ts';

	// Le volet de la personne : son rôle et depuis quand, puis une rangée de gestes visibles. « Remplacer » et « Finir le mandat »
	// (ou « Annuler la nomination ») déplient leur formulaire sur place ; le geste grave demande toujours « Je confirme ».
	// Sans JavaScript, les formulaires sont dépliés d'emblée. Formulaire Remplacer déplié, seul son envoi reste rouge.
	type Reponse = { cible?: string; message?: string; erreurs?: Record<string, string>; valeurs?: Record<string, string> } | null | undefined;
	type Titulaire = Poste['titulaires'][number] & { mandat: NonNullable<Poste['titulaires'][number]['mandat']> };
	let {
		poste,
		titulaire: t,
		agents,
		aujourdhui,
		fiches,
		fermer,
		form,
		onreussite
	}: { poste: Poste; titulaire: Titulaire; agents: Agent[]; aujourdhui: string; fiches: boolean; fermer: string; form: Reponse; onreussite: (message: string) => void } = $props();

	const m = $derived(t.mandat);
	const aVenir = $derived(m.debut > aujourdhui);
	const quand = $derived([aVenir ? `À partir du ${dateCourte(m.debut)}` : `Depuis le ${dateCourte(m.debut)}`, m.fin ? `jusqu’au ${dateCourte(m.fin)}` : ''].filter(Boolean).join(', '));
	const refus = $derived(form?.cible === `mandat-${m.id}` ? form : null);
	const erreurs = $derived(refus?.erreurs ?? {});
	// Le formulaire déplié : celui d'un refus, sinon celui choisi par la rangée de gestes.
	let deplie = $state<'remplacer' | 'finir' | null>(untrack(() => (erreurs.fin || erreurs.confirmation ? 'finir' : erreurs.personneId || erreurs.debut ? 'remplacer' : null)));
	const basculer = (geste: 'remplacer' | 'finir') => (deplie = deplie === geste ? null : geste);
	// Avant JavaScript (ou sans), tout est déplié ; ensuite, seul le formulaire choisi.
	const montre = (geste: 'remplacer' | 'finir') => !monte || deplie === geste;
	// Le remplaçant commence au plus tôt aujourd'hui, et toujours après le début du mandat.
	const debutPropose = $derived(m.debut < aujourdhui ? aujourdhui : ajouterJours(m.debut, 1));
	// La recherche par nom, comme dans le volet « Nommer » ; l'agent déjà choisi reste dans la liste.
	let recherche = $state('');
	let choisi = $state(untrack(() => refus?.valeurs?.personneId ?? ''));
	let monte = $state(false);
	onMount(() => (monte = true));
	const options = $derived(
		agentsPour(agents, poste, [t.id])
			.filter((a) => String(a.id) === choisi || simple(a.nom).includes(simple(recherche)))
			.map((a) => ({ valeur: String(a.id), libelle: a.equipe ? `${a.nom} (${a.equipe})` : a.nom }))
	);
	const etat = surEnvoi(
		() => fermer,
		(m) => onreussite(m)
	);
</script>

<Panneau titre={t.nom} {fermer}>
	<div class="volet">
		<div>
			<p class="poste">{intitule(poste)}</p>
			<p class="doux">{quand}</p>
		</div>
		<div role="alert">{#if refus?.message}<p class="echec">{refus.message}</p>{/if}</div>

		<!-- La rangée de gestes, visibles. Un mandat qui n'a pas commencé ne se remplace pas : on l'annule. -->
		<div class="gestes">
			{#if monte && !aVenir}<Bouton variante={deplie === 'remplacer' ? 'secondaire' : 'principal'} etendu={deplie === 'remplacer'} controle="remplacer-{m.id}" onclick={() => basculer('remplacer')}>Remplacer</Bouton>{/if}
			{#if fiches}<a class="lien-secondaire" href="/agents/{t.id}">Voir sa fiche</a>{/if}
			{#if t.ecrire}<a class="lien-secondaire" href="/echanges/messages/a/{t.id}">Écrire<span class="masque">{` à ${t.nom}`}</span></a>{/if}
			{#if monte}<Bouton variante="grave" etendu={deplie === 'finir'} controle="finir-{m.id}" onclick={() => basculer('finir')}>{aVenir ? 'Annuler la nomination' : 'Finir le mandat'}</Bouton>{/if}
		</div>

		{#if !aVenir}
			<form id="remplacer-{m.id}" method="POST" action="?/remplacer" class="formulaire deplie" hidden={!montre('remplacer')} use:enhance={etat.soumettre}>
				<h3>Remplacer</h3>
				<input type="hidden" name="attributionId" value={m.id} />
				{#if monte}<Champ id="chercher-{m.id}" name="recherche" type="search" libelle="Rechercher par nom" bind:valeur={recherche} />{/if}
				<Choix id="remplacant-{m.id}" name="personneId" libelle="Nouveau titulaire" bind:valeur={choisi} options={[{ valeur: '', libelle: 'Choisissez un agent' }, ...options]} erreur={erreurs.personneId} />
				<Champ id="debut-{m.id}" name="debut" type="date" libelle="À partir du" requis valeur={refus?.valeurs?.debut ?? debutPropose} erreur={erreurs.debut} aide="Le mandat de {t.nom} finira la veille." />
				<div><Bouton type="submit" desactive={etat.envoi}>Confirmer le remplacement</Bouton></div>
			</form>
		{/if}

		{#if aVenir}
			<form id="finir-{m.id}" method="POST" action="?/terminer" class="formulaire deplie" hidden={!montre('finir')} use:enhance={etat.soumettre}>
				<h3>Annuler la nomination</h3>
				<input type="hidden" name="attributionId" value={m.id} />
				<p>Le mandat de {t.nom} ne commencera pas.</p>
				<label class="case"><input type="checkbox" name="confirmation" value="oui" aria-invalid={erreurs.confirmation ? 'true' : undefined} /> Je confirme</label>
				{#if erreurs.confirmation}<p class="erreur">{erreurs.confirmation}</p>{/if}
				<div><Bouton type="submit" variante="grave" desactive={etat.envoi}>Confirmer l’annulation</Bouton></div>
			</form>
		{:else}
			<form id="finir-{m.id}" method="POST" action="?/finir" class="formulaire deplie" hidden={!montre('finir')} use:enhance={etat.soumettre}>
				<h3>Finir le mandat</h3>
				<input type="hidden" name="attributionId" value={m.id} />
				<Champ id="fin-{m.id}" name="fin" type="date" libelle="Dernier jour du mandat" requis valeur={refus?.valeurs?.fin ?? aujourdhui} erreur={erreurs.fin} aide="{t.nom} perd ce rôle, et ses droits, après ce jour." />
				<label class="case"><input type="checkbox" name="confirmation" value="oui" aria-invalid={erreurs.confirmation ? 'true' : undefined} /> Je confirme</label>
				{#if erreurs.confirmation}<p class="erreur">{erreurs.confirmation}</p>{/if}
				<div><Bouton type="submit" variante="grave" desactive={etat.envoi}>Confirmer la fin du mandat</Bouton></div>
			</form>
		{/if}
	</div>
</Panneau>

<style>
	.volet,
	.formulaire {
		display: flex;
		flex-direction: column;
		gap: var(--espace-16);
	}
	.volet {
		gap: var(--espace-20);
	}
	p,
	h3 {
		margin: 0;
	}
	h3 {
		font: 700 var(--texte-18) var(--police-titre);
	}
	.poste {
		font-weight: 600;
	}
	.doux {
		color: var(--doux);
	}
	.gestes {
		display: flex;
		flex-wrap: wrap;
		gap: var(--espace-12);
	}
	/* Liens et boutons de la rangée à la même hauteur, d'une ligne à l'autre. */
	.gestes > a {
		min-height: var(--cible);
	}
	/* Un formulaire déplié sous la rangée de gestes, séparé par un trait fin. */
	.deplie {
		padding-top: var(--espace-16);
		border-top: 1px solid var(--trait-doux);
	}
	.deplie[hidden] {
		display: none;
	}
	.case {
		display: flex;
		align-items: center;
		gap: var(--espace-12);
		min-height: var(--cible);
	}
	.erreur {
		color: var(--accent);
		font-weight: 600;
	}
	.echec {
		padding: var(--espace-12) var(--espace-16);
		border-radius: var(--rayon-petit);
		border: 2px solid var(--accent);
		font-weight: 600;
	}
</style>
