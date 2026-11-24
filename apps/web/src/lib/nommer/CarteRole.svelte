<script lang="ts">
	import { page } from '$app/state';
	import { dateCourte } from '#lib/engins/textes.ts';
	import Rangee from '#lib/ui/Rangee.svelte';
	import { adresseVolet, intitule, type Poste } from './postes.ts';

	// Une carte par rôle. En tête, son nom et au plus un geste. Un rôle à titulaire unique (une fonction, le rapporteur) : « Nommer »
	// tant que personne ne le tient, rien ensuite (on remplace depuis la personne). Un rôle à plusieurs titulaires : « Nommer » s'il est
	// vide, « Ajouter » sinon, et toujours « Ajouter un membre » pour les membres d'un comité. Pour un rôle qu'on ne nomme pas, « Demander ». Dessous, ses titulaires, une ligne par personne (la flèche ouvre son volet),
	// ou « À pourvoir » s'il n'y a personne.
	// `parPerimetre` : un rôle tenu équipe par équipe (ou comité par comité) : une ligne par poste, le titulaire, ou « À pourvoir »
	// avec « Nommer » sur la ligne, chaque poste étant à part.
	let {
		titre,
		postes,
		aujourdhui,
		parPerimetre = false,
		niveau = 3,
		demande
	}: { titre: string; postes: Poste[]; aujourdhui: string; parPerimetre?: boolean; niveau?: 3 | 4; demande?: number } = $props();

	const PERSONNE = 'Personne pour l’instant';
	// Peu de lignes d'un coup : au-delà de cinq titulaires, les autres se déplient par « Voir les N titulaires ».
	const VISIBLES = 5;
	const seul = $derived(parPerimetre ? null : (postes[0] ?? null));
	const geste = $derived.by(() => {
		if (!seul?.nommer) return null;
		const tenu = seul.titulaires.length > 0;
		if (seul.nommer.unique) return tenu ? null : 'Nommer';
		if (seul.role === 'Membre' && seul.perimetre.type === 'comite') return 'Ajouter un membre';
		return tenu ? 'Ajouter' : 'Nommer';
	});
	const nommer = (p: Poste) => adresseVolet(page.url.searchParams, { nommer: p.cle });
	const aVenir = (debut: string | undefined) => (debut && debut > aujourdhui ? `À partir du ${dateCourte(debut)}` : undefined);
	// La sous-ligne d'un titulaire : son équipe ou son comité pour un rôle tenu poste par poste, et le début d'un mandat à venir.
	const sous = (p: Poste, debut: string | undefined) => [parPerimetre ? p.perimetre.nom : null, aVenir(debut)?.toLocaleLowerCase('fr')].filter(Boolean).join(', ') || undefined;
</script>

<!-- Un titulaire : la flèche ouvre son volet ; lu, « Écrire » à droite. -->
{#snippet ligne(p: Poste, t: Poste['titulaires'][number])}
	<li>
		{#if t.mandat}
			<Rangee href={adresseVolet(page.url.searchParams, { mandat: t.mandat.id })} titre={t.nom} grade={t.grade} sous={sous(p, t.mandat.debut)} />
		{:else}
			<Rangee titre={t.nom} grade={t.grade} sous={sous(p, undefined)}>
				{#snippet droite()}{#if t.ecrire}<a class="lien-secondaire geste" href="/echanges/messages/a/{t.id}">Écrire<span class="masque">{` à ${t.nom}`}</span></a>{/if}{/snippet}
			</Rangee>
		{/if}
	</li>
{/snippet}

<ul role="list" class="lignes carte-role">
	<li class="tete">
		<svelte:element this={`h${niveau}`} class="titre-role">{titre}</svelte:element>
		{#if seul && geste}
			<a class="lien-secondaire geste" href={nommer(seul)}>{geste}<span class="masque">{` (${intitule(seul)})`}</span></a>
		{:else if demande && !seul?.nommer}
			<a class="lien-secondaire geste" href="/demandes?role={demande}">Demander<span class="masque">{` au rôle ${titre}`}</span></a>
		{/if}
	</li>
	{#each postes as p (p.cle)}
		{#each p.titulaires.slice(0, VISIBLES) as t (t.mandat?.id ?? t.id)}{@render ligne(p, t)}{/each}
		{#if p.titulaires.length > VISIBLES}
			<li class="suite">
				<details class="repli">
					<summary>Voir les {p.titulaires.length} titulaires</summary>
					<ul role="list" class="reste">
						{#each p.titulaires.slice(VISIBLES) as t (t.mandat?.id ?? t.id)}{@render ligne(p, t)}{/each}
					</ul>
				</details>
			</li>
		{/if}
		{#if p.titulaires.length === 0}
			{@const vide = p.nommer?.aPourvoir ? 'À pourvoir' : PERSONNE}
			<li>
				{#if parPerimetre}
					<Rangee titre={p.perimetre.nom ?? titre} sous={vide} alerte={p.nommer?.aPourvoir ?? false}>
						{#snippet droite()}{#if p.nommer}<a class="lien-secondaire geste" href={nommer(p)}>Nommer<span class="masque">{` (${intitule(p)})`}</span></a>{/if}{/snippet}
					</Rangee>
				{:else}
					<Rangee titre={vide} alerte={p.nommer?.aPourvoir ?? false} discret={!p.nommer?.aPourvoir} />
				{/if}
			</li>
		{/if}
	{/each}
</ul>

<style>
	/* L'en-tête de la carte : le nom du rôle, son geste à droite, un peu d'air avant les titulaires. */
	.tete {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--espace-12);
		padding: var(--espace-16) var(--espace-16) var(--espace-12);
		min-height: var(--cible);
	}
	.suite summary {
		padding: 0 var(--espace-16);
	}
	.reste {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.reste > li {
		border-top: 1px solid var(--trait-doux);
	}
	.titre-role {
		margin: 0;
		font: 700 var(--texte-18) / 1.2 var(--police-titre);
		overflow-wrap: anywhere;
	}
	/* Plus serré qu'un lien de page : il tient dans la ligne, au téléphone aussi. */
	.geste {
		flex: none;
		min-height: 40px;
		padding: 0 var(--espace-12);
		font-size: var(--texte-15);
	}
</style>
