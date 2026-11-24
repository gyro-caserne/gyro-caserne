<script lang="ts">
	import { untrack } from 'svelte';
	import { page } from '$app/state';
	import Rangee from '#lib/ui/Rangee.svelte';
	import CarteRole from './CarteRole.svelte';
	import Volets from './Volets.svelte';
	import { posteVise, voletVise, type Agent, type Poste } from './postes.ts';

	// Le bloc « Titulaires » d'une fiche de réglage : les mêmes cartes et les mêmes volets que Qui fait quoi.
	// La fiche d'un rôle (`role`, son nom) : une seule carte, une ligne par équipe ou par comité s'il en a. La fiche d'un comité :
	// une carte par rôle du comité, au nom du rôle, puis les membres que ces cartes ne montrent pas.
	// Replié, sauf juste après la création (`question` : « Qui le tiendra ? ») ou quand on vise l'un de ses postes.
	type Reponse = { cible?: string; succes?: string; message?: string; erreurs?: Record<string, string>; valeurs?: Record<string, string> } | null | undefined;
	type Membre = { id: number; nom: string; grade: string | null; roles: string[] };
	let {
		postes,
		role,
		autres = [],
		resume,
		question,
		gestes,
		aujourdhui,
		fiches,
		form
	}: { postes: Poste[]; role?: string; autres?: Membre[]; resume: string; question?: string; gestes: { agents: Agent[] } | null; aujourdhui: string; fiches: boolean; form: unknown } = $props();
	// La réponse d'une action de la page : seules celles des volets (cibles `nommer-` et `mandat-`) concernent ce bloc.
	const reponse = $derived(form as Reponse);

	const vise = $derived(posteVise(postes, voletVise(page.url.searchParams, reponse)) !== null || (Boolean(reponse?.succes) && /^(nommer|mandat)-/.test(String(reponse?.cible ?? ''))));
	let reussite = $state('');
	// Ouvert dès le chargement par l'attribut ; ensuite, par la page, sans jamais le refermer.
	const ouvertAuDepart = untrack(() => Boolean(question) || vise);
	const garderOuvert = (bloc: HTMLDetailsElement) => {
		if (vise) bloc.open = true;
	};
	$effect(() => {
		if (posteVise(postes, voletVise(page.url.searchParams, reponse))) reussite = '';
	});
	const annonce = $derived(reussite || (reponse?.succes && /^(nommer|mandat)-/.test(String(reponse.cible ?? '')) ? String(reponse.succes) : ''));
</script>

<details class="repli titulaires" {...ouvertAuDepart ? { open: true } : {}} {@attach garderOuvert}>
	<summary><span class="entete"><h2 class="titre-groupe">Titulaires</h2><span class="resume">{resume}</span></span></summary>
	<div class="contenu">
		{#if question}<p class="question">{question}</p>{/if}
		<div role="status">{#if annonce}<p class="succes">{annonce}</p>{/if}</div>
		{#if role !== undefined}
			<CarteRole titre={role} {postes} {aujourdhui} parPerimetre={postes.some((p) => p.perimetre.type !== 'centre')} />
		{:else}
			{#each postes as p (p.cle)}<CarteRole titre={p.role} postes={[p]} {aujourdhui} />{/each}
			{#if autres.length > 0}
				<ul role="list" class="lignes">
					{#each autres as m (m.id)}<li><Rangee titre={m.nom} grade={m.grade} sous={m.roles.join(', ')} /></li>{/each}
				</ul>
			{/if}
			{#if postes.length === 0 && autres.length === 0}<ul role="list" class="lignes"><li><Rangee titre="Personne pour l’instant" discret /></li></ul>{/if}
		{/if}
	</div>
</details>

{#if gestes}
	<Volets {postes} agents={gestes.agents} {aujourdhui} {fiches} form={reponse} onreussite={(m) => (reussite = m)} />
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
		gap: var(--espace-24);
		padding-top: var(--espace-12);
		padding-bottom: var(--espace-12);
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
