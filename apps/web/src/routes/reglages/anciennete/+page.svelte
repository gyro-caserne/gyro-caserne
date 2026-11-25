<script lang="ts">
	import { enhance } from '$app/forms';
	import Bouton from '#lib/ui/Bouton.svelte';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';
	import { ans } from '@gyro-caserne/socle';

	let { data, form } = $props();

	// Un palier tous les 5 ans, de 5 à 50 ; un palier déjà réglé hors de cette liste reste proposé.
	const choix = $derived([...new Set([5, 10, 15, 20, 25, 30, 35, 40, 45, 50, ...data.paliers])].sort((a, b) => a - b));
	let envoi = $state(false);
</script>

<svelte:head>
	<title>Paliers d’ancienneté</title>
</svelte:head>

<div class="page">
	<EnTetePage titre="Paliers d’ancienneté" phrase="Les années de service que le centre fête, comptées depuis l’engagement SPV. Le chef de centre et l’adjoint sont prévenus 30 jours avant." />

	<div role="status" class="masque">{form?.succes ?? ''}</div>
	{#if form?.succes}<p class="succes">{form.succes}</p>{/if}
	{#if form?.message}<p class="echec" role="alert">{form.message}</p>{/if}

	<form
		method="POST"
		action="?/enregistrer"
		class="carte"
		use:enhance={() => {
			envoi = true;
			return async ({ update }) => {
				await update({ reset: false });
				envoi = false;
			};
		}}
	>
		<fieldset>
			<legend class="titre-groupe">Paliers fêtés</legend>
			<p class="doux" id="aide-paliers">Par exemple ceux de la médaille d’honneur des sapeurs-pompiers, 10, 20, 25, 30 et 40 ans.</p>
			<div class="paliers">
				{#each choix as p (p)}
					<label class="palier"><input type="checkbox" name="palier" value={p} checked={data.paliers.includes(p)} aria-describedby="aide-paliers" />{ans(p)}</label>
				{/each}
			</div>
		</fieldset>
		<Bouton type="submit" desactive={envoi}>Enregistrer les paliers</Bouton>
	</form>
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--espace-16);
		max-width: var(--largeur-lecture);
	}
	p {
		margin: 0;
	}
	.doux {
		color: var(--doux);
	}
	.carte {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--espace-16);
		padding: var(--espace-16);
		background: var(--surface);
		border: 1px solid transparent;
		box-shadow: var(--ombre-carte);
		border-radius: var(--rayon-grand);
	}
	fieldset {
		display: flex;
		flex-direction: column;
		gap: var(--espace-8);
		width: 100%;
		margin: 0;
		padding: 0;
		border: 0;
	}
	legend {
		padding: 0;
		margin-bottom: var(--espace-4);
	}
	/* Deux colonnes au téléphone, cinq à l'ordinateur : chaque case, toute la ligne se touche. */
	.paliers {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0 var(--espace-16);
	}
	@media (min-width: 640px) {
		.paliers {
			grid-template-columns: repeat(5, 1fr);
		}
	}
	.palier {
		display: flex;
		align-items: center;
		gap: var(--espace-12);
		min-height: var(--cible);
		font-weight: 600;
		cursor: pointer;
	}
	.succes,
	.echec {
		padding: var(--espace-12) var(--espace-16);
		border-radius: var(--rayon-petit);
		border: 1px solid var(--trait);
		font-weight: 600;
	}
	.echec {
		border-color: var(--accent);
	}
</style>
