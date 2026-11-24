<script lang="ts">
	import { page } from '$app/state';
	import { dateCourte } from '#lib/engins/textes.ts';
	import Rangee from '#lib/ui/Rangee.svelte';
	import { adresseVolet, intitule, type Poste } from './postes.ts';

	// Les lignes d'un poste pour qui peut y nommer : une par titulaire (toute la ligne ouvre son volet), puis « Nommer »
	// s'il n'y a personne, ou toujours pour une mission. `libelle` : ce que dit la ligne (le rôle, l'équipe, le comité).
	let { poste, libelle, aujourdhui }: { poste: Poste; libelle: string; aujourdhui: string } = $props();

	const vide = $derived(poste.titulaires.length === 0);
	const sous = (debut: string | undefined) => (debut && debut > aujourdhui ? `${libelle}, à partir du ${dateCourte(debut)}` : libelle);
</script>

{#each poste.titulaires as t (t.mandat?.id ?? t.id)}
	{#if t.mandat}
		<li><Rangee href={adresseVolet(page.url.searchParams, { mandat: t.mandat.id })} titre={t.nom} grade={t.grade} sous={sous(t.mandat.debut)} /></li>
	{/if}
{/each}
{#if poste.nommer && (vide || poste.nature === 'mission')}
	<li>
		<Rangee titre={libelle} sous={vide ? (poste.nommer.aPourvoir ? 'À pourvoir' : 'Personne pour l’instant') : undefined} alerte={poste.nommer.aPourvoir} discret={!vide}>
			{#snippet droite()}<a class="lien-secondaire nommer" href={adresseVolet(page.url.searchParams, { nommer: poste.cle })}>Nommer<span class="masque">{` (${intitule(poste)})`}</span></a>{/snippet}
		</Rangee>
	</li>
{/if}

<style>
	/* Plus serré qu'un lien de page : il tient dans la ligne, au téléphone aussi. */
	.nommer {
		min-height: 40px;
		padding: 0 var(--espace-12);
		font-size: var(--texte-15);
	}
</style>
