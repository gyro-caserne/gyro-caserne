<script lang="ts">
	import EnTetePage from '#lib/ui/EnTetePage.svelte';
	import { untrack } from 'svelte';
	import type { Droit } from '@gyro-caserne/socle';
	import { DOMAINES, niveauxDe } from '#lib/paquets.ts';
	import { pluriel } from '#lib/pluriel.ts';
	import BarreActions from '#lib/ui/BarreActions.svelte';
	import Bouton from '#lib/ui/Bouton.svelte';
	import Champ from '#lib/ui/Champ.svelte';
	import SelecteurNiveaux from '#lib/ui/SelecteurNiveaux.svelte';
	import IconeRole from '#lib/ui/IconeRole.svelte';
	import Domaines from '../../Domaines.svelte';

	let { data, form } = $props();

	const droits = $derived(data.profil.droits as Droit[]);
	let choix = $state(untrack(() => niveauxDe(droits)));
	$effect.pre(() => {
		choix = niveauxDe(droits);
	});
	const depart = $derived(niveauxDe(droits));
	const modifies = $derived(DOMAINES.filter((d) => choix[d.id] !== depart[d.id]).length);
	const message = $derived(modifies === 0 ? '' : modifies === 1 ? '1 domaine modifié, pas encore enregistré' : `${modifies} domaines modifiés, pas encore enregistrés`);

	const concerne = (cible: string) => form?.cible === cible;
	// Un bloc s'ouvre seulement s'il est visé ; sinon aucun attribut open n'est posé, et l'hydratation ne referme pas ce qui a été ouvert.
	const ouvert = (cible: string) => (concerne(cible) && !form?.succes ? { open: true } : {});
	const exterieur = $derived(data.profil.typePersonne === 'exterieur');
	// Les murs qui s'ouvrent : Le centre, Vie du centre et les comités en cours (jamais les équipes).
	const murs = $derived([{ cle: 'centre', nom: 'Le centre' }, { cle: 'vie', nom: 'Vie du centre' }, ...(data.comitesChoix ?? []).map((c: { id: number; nom: string }) => ({ cle: `comite:${c.id}`, nom: c.nom }))]);
	// Envoyés par leur rang : 0 aucun accès, 1 lecture, 2 écriture.
	const NIVEAUX = ['aucun', 'lecture', 'ecriture'];
	const niveauxDuMur = (cle: string) => [
		{ libelle: 'Aucun accès', phrase: 'Ce mur reste fermé.' },
		{ libelle: 'Lecture', phrase: 'Voir les publications et en être prévenu.' },
		{ libelle: 'Écriture', phrase: cle === 'centre' ? 'Aussi commenter, voter et répondre.' : 'Aussi commenter, voter, répondre et publier.' }
	];
	// La ligne sous « Murs ouverts », replié : les murs ouverts par leur nom, ou aucun.
	const resumeMurs = $derived.by(() => {
		const noms = murs.filter((m) => niveauDe(m.cle) > 0).map((m) => m.nom);
		if (noms.length === 0) return 'Aucun mur ouvert';
		return noms.length === 1 ? `${noms[0]} ouvert` : `${noms.slice(0, -1).join(', ')} et ${noms.at(-1)} ouverts`;
	});
	const niveauDe = (cle: string) => Math.max(0, NIVEAUX.indexOf((data.profil.mursOuverts as Record<string, string>)[cle] ?? 'aucun'));
</script>

{#snippet retour(cible: string)}
	<div role="alert">
		{#if concerne(cible) && (form?.message || form?.erreurs)}<p class="echec">{form?.message ?? 'Le formulaire contient des erreurs.'}</p>{/if}
	</div>
	<div role="status">
		{#if concerne(cible) && form?.succes}<p class="succes">{form.succes}</p>{/if}
	</div>
{/snippet}

<svelte:head>
	<title>{data.profil.nom}</title>
</svelte:head>

<EnTetePage titre={data.profil.nom} phrase="Profil des {data.profil.typePersonne === 'agent' ? 'agents du centre' : 'personnes extérieures'}">
	{#snippet tete()}<IconeRole icone="casque" taille={48} />{/snippet}
</EnTetePage>

{@render retour('profil')}

<p class="intro">Ce que ce profil donne à chaque personne qui l’a, domaine par domaine. Les droits de base (voir le planning, les engins…) ne se règlent pas ici.</p>

<form method="POST" action="?/enregistrer" class="formulaire">
	<Domaines droits={droits} bind:choix profil />
	{#if exterieur}
		<details class="pli repli murs-pli">
			<summary>
				<span class="titre-pli">Murs ouverts</span>
				<span class="resume">{resumeMurs}</span>
			</summary>
			<p class="aide">En lecture, on voit les publications et on en est prévenu. En écriture, on peut aussi commenter, voter, répondre et publier (sauf sur Le centre). Un comité ouvert en écriture donne la messagerie avec ses membres.</p>
			<ul class="murs" role="list">
				{#each murs as m (m.cle)}
					<li>
						<p class="mur" aria-hidden="true">{m.nom}</p>
						<SelecteurNiveaux name="mur-{m.cle}" legende={m.nom} niveaux={niveauxDuMur(m.cle)} valeur={niveauDe(m.cle)} segments />
					</li>
				{/each}
			</ul>
		</details>
	{/if}
	<BarreActions {message}>
		<Bouton type="submit">Enregistrer</Bouton>
	</BarreActions>
</form>

<details class="plus">
	<summary>Plus</summary>
	<div class="gestes">
		<details class="pli repli" {...ouvert('renommer')}>
			<summary>Renommer le profil</summary>
			{@render retour('renommer')}
			<form method="POST" action="?/renommer" class="formulaire">
				<Champ id="profil-nom" name="nom" libelle="Nom" requis maxlength={60} valeur={concerne('renommer') ? (form?.valeurs?.nom ?? data.profil.nom) : data.profil.nom} erreur={concerne('renommer') ? form?.erreurs?.nom : undefined} />
				<Bouton type="submit" variante="secondaire">Renommer le profil</Bouton>
			</form>
		</details>
		{#if data.profil.depart}
			<p class="aide">Le profil des agents de départ ne se supprime pas.</p>
		{:else if data.profil.personnes > 0}
			<p class="aide">{pluriel(data.profil.personnes, 'personne a', 'personnes ont')} ce profil. Il se supprime quand plus personne ne l’a.</p>
		{:else}
			<details class="pli repli" {...ouvert('supprimer')}>
				<summary>Supprimer le profil</summary>
				{@render retour('supprimer')}
				<form method="POST" action="?/supprimer" class="formulaire">
					<p class="avertissement">Le profil et ses réglages seront effacés. Personne ne l’a aujourd’hui.</p>
					<label class="case"><input type="checkbox" name="confirmation" value="oui" /> Je confirme</label>
					<Bouton type="submit" variante="grave">Supprimer le profil</Bouton>
				</form>
			</details>
		{/if}
	</div>
</details>

<style>
	p {
		margin: 0;
	}
	.intro {
		color: var(--doux);
	}
	.formulaire {
		display: flex;
		flex-direction: column;
		gap: var(--espace-12);
	}
	.formulaire > :global(button) {
		align-self: flex-start;
	}
	h2 {
		margin: 0;
	}
	.aide {
		color: var(--doux);
	}
	.carte {
		background: var(--surface);
		border-radius: var(--rayon-grand);
		padding: var(--espace-16);
		display: flex;
		flex-direction: column;
		gap: var(--espace-12);
	}
	.murs {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.murs > li {
		padding: var(--espace-12) 0;
		display: flex;
		flex-direction: column;
		gap: var(--espace-8);
	}
	.mur {
		margin: 0;
		font-weight: 700;
	}
	.murs > li + li {
		border-top: 1px solid var(--trait-doux);
	}
	.gestes {
		display: flex;
		flex-direction: column;
		gap: var(--espace-12);
		padding-top: var(--espace-12);
	}
	.pli {
		background: var(--surface);
		border-radius: var(--rayon-grand);
		padding: 0 var(--espace-16);
	}
	.pli > summary {
		min-height: 56px;
		display: flex;
		align-items: center;
		font-weight: 600;
		cursor: pointer;
	}
	.murs-pli > summary {
		flex-direction: column;
		align-items: flex-start;
		justify-content: center;
		padding: var(--espace-8) 0;
	}
	.titre-pli {
		font: 700 var(--texte-18)/1.2 var(--police-titre);
	}
	.resume {
		font-weight: 400;
		color: var(--doux);
	}
	.murs-pli > .murs {
		padding-bottom: var(--espace-16);
	}
	.pli .formulaire {
		padding-bottom: var(--espace-16);
	}
	.case {
		display: flex;
		align-items: center;
		gap: var(--espace-12);
		min-height: var(--cible);
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
