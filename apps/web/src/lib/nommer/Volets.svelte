<script lang="ts">
	import { page } from '$app/state';
	import VoletNommer from './VoletNommer.svelte';
	import VoletTitulaire from './VoletTitulaire.svelte';
	import { adresseVolet, posteVise, voletVise, type Agent, type Poste } from './postes.ts';

	// Le volet ouvert par l'adresse (`?mandat=`, `?nommer=`) ou rouvert par un refus : la personne, ou « Nommer ».
	type Reponse = { cible?: string; succes?: string; message?: string; erreurs?: Record<string, string>; valeurs?: Record<string, string> } | null | undefined;
	let { postes, agents, aujourdhui, fiches, form, onreussite }: { postes: Poste[]; agents: Agent[]; aujourdhui: string; fiches: boolean; form: Reponse; onreussite: (message: string) => void } = $props();

	const fermer = $derived(adresseVolet(page.url.searchParams, null));
	const ouvert = $derived(posteVise(postes, voletVise(page.url.searchParams, form)));
</script>

{#if ouvert?.titulaire}
	{#key ouvert.titulaire.mandat.id}
		<VoletTitulaire poste={ouvert.poste} titulaire={ouvert.titulaire} {agents} {aujourdhui} {fiches} {fermer} {form} {onreussite} />
	{/key}
{:else if ouvert}
	{#key ouvert.poste.cle}
		<VoletNommer poste={ouvert.poste} {agents} {aujourdhui} {fermer} {form} {onreussite} />
	{/key}
{/if}
