<script lang="ts">
	import { page } from '$app/state';
	import Insigne from '#lib/ui/Insigne.svelte';
	import Rangee from '#lib/ui/Rangee.svelte';
	import LignesPoste from './LignesPoste.svelte';
	import Volets from './Volets.svelte';
	import { posteVise, voletVise, type Agent, type Poste } from './postes.ts';

	// Le bloc « Titulaires » d'une fiche de réglage (un rôle, un comité) : les mêmes lignes et les mêmes volets que Qui fait quoi.
	// Replié, sauf juste après la création (`question` : « Qui le tiendra ? ») ou quand on vise l'un de ses postes.
	type Reponse = { cible?: string; succes?: string; message?: string; erreurs?: Record<string, string>; valeurs?: Record<string, string> } | null | undefined;
	type Membre = { id: number; nom: string; grade: string | null; roles: string[] };
	let {
		postes,
		autres = [],
		resume,
		question,
		gestes,
		aujourdhui,
		fiches,
		form
	}: { postes: Poste[]; autres?: Membre[]; resume: string; question?: string; gestes: { agents: Agent[] } | null; aujourdhui: string; fiches: boolean; form: Reponse } = $props();

	const vise = $derived(posteVise(postes, voletVise(page.url.searchParams, form)) !== null || (Boolean(form?.succes) && /^(nommer|mandat)-/.test(String(form?.cible ?? ''))));
	let reussite = $state('');
	const annonce = $derived(reussite || (form?.succes && /^(nommer|mandat)-/.test(String(form.cible ?? '')) ? String(form.succes) : ''));
	const libelle = (p: Poste) => p.perimetre.nom ?? p.role;
</script>

<details class="repli titulaires" {...question || vise ? { open: true } : {}}>
	<summary><span class="entete"><h2 class="titre-groupe">Titulaires</h2><span class="resume">{resume}</span></span></summary>
	<div class="contenu">
		{#if question}<p class="question">{question}</p>{/if}
		<div role="status">{#if annonce}<p class="succes">{annonce}</p>{/if}</div>
		<ul role="list" class="lignes">
			{#each postes as p (p.cle)}
				{#if p.nommer}
					<LignesPoste poste={p} libelle={libelle(p)} {aujourdhui} />
				{:else}
					{#snippet noms()}{#each p.titulaires as t, i (t.id)}{#if i > 0}{', '}{/if}{t.nom}<Insigne grade={t.grade} />{:else}Personne pour l’instant{/each}{/snippet}
					<li><Rangee titre={libelle(p)} sousContenu={noms} /></li>
				{/if}
			{/each}
			{#each autres as m (m.id)}
				<li><Rangee titre={m.nom} grade={m.grade} sous={m.roles.join(', ')} /></li>
			{/each}
			{#if postes.length === 0 && autres.length === 0}<li><Rangee titre="Personne pour l’instant" discret /></li>{/if}
		</ul>
	</div>
</details>

{#if gestes}
	<Volets {postes} agents={gestes.agents} {aujourdhui} {fiches} {form} onreussite={(m) => (reussite = m)} />
{/if}

<style>
	.titulaires > summary {
		min-height: 56px;
	}
	.entete {
		display: flex;
		flex-direction: column;
	}
	.entete h2,
	p {
		margin: 0;
	}
	.resume {
		color: var(--doux);
		font-weight: 400;
		font-size: var(--texte-15);
	}
	.contenu {
		display: flex;
		flex-direction: column;
		gap: var(--espace-12);
		padding-top: var(--espace-8);
	}
	.question {
		font-weight: 600;
	}
	div[role='status']:empty {
		margin-top: calc(-1 * var(--espace-12));
	}
	.succes {
		padding: var(--espace-12) var(--espace-16);
		border-radius: var(--rayon-petit);
		border: 2px solid var(--ok);
		font-weight: 600;
	}
</style>
