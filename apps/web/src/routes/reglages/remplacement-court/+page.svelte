<script lang="ts">
	import { enhance } from '$app/forms';
	import Bouton from '#lib/ui/Bouton.svelte';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';
	import { DUREES_COURT } from '@gyro-caserne/socle';

	let { data, form } = $props();
	let envoi = $state(false);
</script>

<svelte:head>
	<title>Remplacement court</title>
</svelte:head>

<div class="page">
	<EnTetePage titre="Remplacement court" phrase="Les durées proposées à l’agent qui se fait remplacer quelques heures. Les demandes déjà envoyées gardent la leur." />

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
			<legend class="titre-groupe">Durées proposées</legend>
			<p class="doux" id="aide-durees">Au moins une. Par défaut, 2 h et 3 h.</p>
			<div class="durees">
				{#each DUREES_COURT as d (d)}
					<label class="duree"><input type="checkbox" name="duree" value={d} checked={data.durees.includes(d)} aria-describedby="aide-durees" />{d} h</label>
				{/each}
			</div>
		</fieldset>
		<Bouton type="submit" desactive={envoi}>Enregistrer les durées</Bouton>
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
	/* Deux colonnes au téléphone, quatre à l'ordinateur : chaque case, toute la ligne se touche. */
	.durees {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0 var(--espace-16);
	}
	@media (min-width: 640px) {
		.durees {
			grid-template-columns: repeat(4, 1fr);
		}
	}
	.duree {
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
