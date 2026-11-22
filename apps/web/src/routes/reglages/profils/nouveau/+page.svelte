<script lang="ts">
	import EnTetePage from '#lib/ui/EnTetePage.svelte';
	import Bouton from '#lib/ui/Bouton.svelte';
	import Champ from '#lib/ui/Champ.svelte';
	import ChoixRadio from '#lib/ui/ChoixRadio.svelte';

	let { form } = $props();
	const erreurs = $derived<Record<string, string>>(form?.erreurs ?? {});
	const TYPES = [
		{ valeur: 'agent', libelle: 'Agent', sous: 'Pompier du centre, au planning et aux remplacements' },
		{ valeur: 'exterieur', libelle: 'Extérieur', sous: 'Hors du planning, avec seulement les murs qu’on lui ouvre' }
	];
</script>

<svelte:head>
	<title>Nouveau profil</title>
</svelte:head>

<EnTetePage titre="Nouveau profil" phrase="Ses droits, et pour un extérieur ses murs ouverts, se règlent ensuite." />
<div role="alert">
	{#if form?.message || form?.erreurs}<p class="echec">{form?.message ?? 'Le formulaire contient des erreurs.'}</p>{/if}
</div>
<form method="POST" class="formulaire">
	<Champ id="profil-nom" name="nom" libelle="Nom" requis maxlength={60} valeur={form?.valeurs?.nom ?? ''} erreur={erreurs.nom} />
	<ChoixRadio id="profil-type" name="type" legende="Type" options={TYPES} disposition="rangees" requis valeur={form?.valeurs?.type ?? ''} erreur={erreurs.type} />
	<Bouton type="submit">Créer le profil</Bouton>
</form>

<style>
	p {
		margin: 0;
	}
	.formulaire {
		display: flex;
		flex-direction: column;
		gap: var(--espace-16);
		max-width: var(--largeur-lecture);
		padding: var(--espace-16);
		background: var(--surface);
		border-radius: var(--rayon-grand);
	}
	.formulaire > :global(button) {
		align-self: flex-start;
	}
	.echec {
		padding: var(--espace-12) var(--espace-16);
		border-radius: var(--rayon-petit);
		border: 2px solid var(--accent);
		font-weight: 600;
	}
</style>
