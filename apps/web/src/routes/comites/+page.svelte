<script lang="ts">
	import { untrack, type Snippet } from 'svelte';
	import { page } from '$app/state';
	import { murDuComite } from '#lib/murs/phrases.ts';
	import CarteRole from '#lib/nommer/CarteRole.svelte';
	import Volets from '#lib/nommer/Volets.svelte';
	import { adresseVolet, aPourvoir, cleDePoste, intitule, postesDe, posteVise, resume, voletVise, type Poste } from '#lib/nommer/postes.ts';
	import { pluriel } from '#lib/pluriel.ts';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';
	import ListeRangees from '#lib/ui/ListeRangees.svelte';
	import Insigne from '#lib/ui/Insigne.svelte';
	import Rangee from '#lib/ui/Rangee.svelte';
	import type { IconeRole as NomIcone } from '#lib/ui/icones-roles.ts';

	let { data, form } = $props();

	type Titulaire = { id: number; nom: string; grade: string | null; ecrire: boolean };
	const PERSONNE = 'Personne pour l’instant';
	// Les rôles d'équipe, rangés selon leur nature.
	const avecEquipes = $derived(data.equipes.filter((r) => r.parEquipe.length > 0));
	const fonctionsEquipe = $derived(avecEquipes.filter((r) => r.nature === 'fonction'));
	const missionsEquipe = $derived(avecEquipes.filter((r) => r.nature === 'mission'));

	// Les postes de la page, à plat : « À pourvoir », les volets, et les groupes à ouvrir.
	const postes = $derived(postesDe(data));
	const parCle = $derived(new Map(postes.map((p) => [p.cle, p])));
	const posteDe = (roleId: number, perimetreId: number | null) => parCle.get(cleDePoste(roleId, perimetreId))!;
	const manquants = $derived(aPourvoir(postes));

	// Un groupe s'ouvre quand on vise l'un de ses postes : volet ouvert, refus, ou réussite sans JavaScript.
	const visePoste = $derived.by(() => {
		const ouvert = posteVise(postes, voletVise(page.url.searchParams, form));
		if (ouvert) return ouvert.poste.cle;
		const reussi = form?.succes ? String(form.cible ?? '') : '';
		if (reussi.startsWith('nommer-')) return reussi.slice(7);
		return reussi.startsWith('mandat-') ? (posteVise(postes, { mandat: Number(reussi.slice(7)) })?.poste.cle ?? null) : null;
	});
	// Ouvert dès le chargement par l'attribut ; ensuite, par la page, sans jamais le refermer (le volet fermé, on reste où l'on était).
	const viseAuDepart = untrack(() => visePoste);
	const ouvert = (cles: string[]) => (viseAuDepart && cles.includes(viseAuDepart) ? { open: true } : {});
	const garderOuvert = (cles: string[]) => (groupe: HTMLDetailsElement) => {
		if (visePoste && cles.includes(visePoste)) groupe.open = true;
	};

	// Une réussite avec JavaScript (le volet s'est fermé) ou sans (la page revient avec la réponse).
	let reussite = $state('');
	// Un volet qui s'ouvre efface l'annonce précédente.
	$effect(() => {
		if (posteVise(postes, voletVise(page.url.searchParams, form))) reussite = '';
	});
	const annonce = $derived(reussite || (form?.succes ? String(form.succes) : ''));

	const resumeRoles = (roles: { id: number }[], centre = true) => resume(pluriel(roles.length, 'rôle'), centre ? roles.map((r) => posteDe(r.id, null)) : []);
	const resumeEquipes = (r: (typeof data.equipes)[number]) => resume(pluriel(r.parEquipe.length, 'équipe'), r.parEquipe.map((l) => posteDe(r.id, l.equipeId)));
	const postesDeComites = $derived(postes.filter((p) => p.perimetre.type === 'comite'));
</script>

<svelte:head>
	<title>Qui fait quoi</title>
</svelte:head>

<!-- « Écrire » ouvre la conversation à deux, comme « Message » sur la fiche d'un agent. -->
{#snippet ecrire(t: Titulaire, nomVisible = false)}
	{#if nomVisible}
		<a class="lien-secondaire ecrire" href="/echanges/messages/a/{t.id}">{`Écrire à ${t.nom}`}</a>
	{:else}
		<a class="lien-secondaire ecrire" href="/echanges/messages/a/{t.id}">Écrire<span class="masque">{` à ${t.nom}`}</span></a>
	{/if}
{/snippet}

<!-- Les titulaires, chacun avec l'insigne de son grade. -->
{#snippet noms(titulaires: Titulaire[])}
	{#each titulaires as t, i (t.id)}{#if i > 0}{', '}{/if}{t.nom}<Insigne grade={t.grade} />{:else}{PERSONNE}{/each}
{/snippet}

<!-- Un rôle qui reçoit des demandes : « Demander » mène à la nouvelle demande, ce rôle choisi. -->
{#snippet demander(id: number, titre: string)}
	<a class="lien-secondaire ecrire" href="/demandes?role={id}">Demander<span class="masque">{` au rôle ${titre}`}</span></a>
{/snippet}

<!-- Un poste lu : un titulaire, « Écrire » à droite ; plusieurs, un « Écrire à » par titulaire, sous les noms. -->
{#snippet lu(titre: string, titulaires: Titulaire[], icone?: NomIcone, demande?: number)}
	{@const ecrits = titulaires.filter((t) => t.ecrire)}
	{#snippet sousNoms()}{@render noms(titulaires)}{/snippet}
	<li>
		{#if titulaires.length > 1 && (ecrits.length > 0 || demande)}
			<Rangee {icone} {titre} sousContenu={sousNoms}>
				{#if demande}{@render demander(demande, titre)}{/if}
				{#each ecrits as t (t.id)}{@render ecrire(t, true)}{/each}
			</Rangee>
		{:else}
			<Rangee {icone} {titre} sousContenu={sousNoms}>
				{#snippet droite()}{#if demande}{@render demander(demande, titre)}{/if}{#if ecrits[0]}{@render ecrire(ecrits[0])}{/if}{/snippet}
			</Rangee>
		{/if}
	</li>
{/snippet}

<!-- Un groupe replié, avec sa ligne de résumé ; il s'ouvre quand on vise l'un de ses postes. -->
{#snippet groupe(titre: string, sommaire: string, cles: string[], contenu: Snippet)}
	<details class="repli groupe" {...ouvert(cles)} {@attach garderOuvert(cles)}>
		<summary><span class="entete"><h2 class="titre-groupe">{titre}</h2><span class="resume">{sommaire}</span></span></summary>
		<div class="contenu">{@render contenu()}</div>
	</details>
{/snippet}

<!-- Un rôle tenu équipe par équipe. -->
{#snippet parEquipe(r: (typeof data.equipes)[number])}
	{#snippet lignes()}
		{#if data.gestes}
			<CarteRole titre={r.nom} postes={r.parEquipe.map((e) => posteDe(r.id, e.equipeId))} aujourdhui={data.aujourdhui} parPerimetre />
		{:else}
			<ul role="list" class="lignes">
				{#each r.parEquipe as e (e.equipeId)}{@render lu(e.equipe, e.titulaires)}{/each}
			</ul>
		{/if}
	{/snippet}
	{@render groupe(r.systeme === 'chef_equipe' ? 'Chefs de garde' : r.nom, resumeEquipes(r), r.parEquipe.map((e) => cleDePoste(r.id, e.equipeId)), lignes)}
{/snippet}

{#snippet comites()}
	{#each data.comites as c (c.id)}
		{@const nommables = (c.postes ?? []).map((p) => posteDe(p.id, c.id))}
		{#if nommables.length > 0}
			<!-- Pour qui y nomme : une carte par rôle du comité, puis le mur, le matériel et les autres membres. -->
			{@const tenus = new Set(nommables.flatMap((p) => p.titulaires.map((t) => t.id)))}
			{@const autres = c.membres.filter((m) => !tenus.has(m.id))}
			<section class="comite" aria-labelledby="comite-{c.id}">
				<h3 id="comite-{c.id}" class="titre-groupe">{c.nom}</h3>
				{#each nommables as p (p.cle)}<CarteRole titre={p.role} postes={[p]} aujourdhui={data.aujourdhui} niveau={4} />{/each}
				{#if autres.length > 0 || c.mur || c.ressources.length > 0}
					<ul role="list" class="lignes">
						{#each autres as m (m.id)}
							<li>
								<Rangee titre={m.nom} grade={m.grade} sous={m.roles.join(', ')}>
									{#snippet droite()}{#if m.ecrire}{@render ecrire(m)}{/if}{/snippet}
								</Rangee>
							</li>
						{/each}
						{#if c.mur}<li><Rangee href="/echanges/comite:{c.id}" titre={murDuComite(c.nom)} /></li>{/if}
						{#each c.ressources as r (r.id)}<li><Rangee href="/reservations/{r.id}" titre={r.nom} sous="À réserver" /></li>{/each}
					</ul>
				{/if}
			</section>
		{:else}
			<ListeRangees titre={c.nom} compte={c.membres.length} niveau={3}>
				{#if c.membres.length > 0}<li class="intertitre"><h4>Membres</h4></li>{/if}
				{#each c.membres as m (m.id)}
					<li>
						<Rangee titre={m.nom} grade={m.grade} sous={m.roles.join(', ')}>
							{#snippet droite()}{#if m.ecrire}{@render ecrire(m)}{/if}{/snippet}
						</Rangee>
					</li>
				{:else}
					<li><Rangee titre="Aucun membre pour l’instant" discret /></li>
				{/each}
				{#if c.mur}
					<li><Rangee href="/echanges/comite:{c.id}" titre={murDuComite(c.nom)} /></li>
				{/if}
				{#if c.ressources.length > 0}<li class="intertitre"><h4>À réserver</h4></li>{/if}
				{#each c.ressources as r (r.id)}
					<li><Rangee href="/reservations/{r.id}" titre={r.nom} /></li>
				{/each}
			</ListeRangees>
		{/if}
	{:else}
		<ul role="list" class="lignes"><li><Rangee titre="Aucun comité pour l’instant" discret /></li></ul>
	{/each}
{/snippet}

<!-- Les rôles du centre d'un groupe : pour qui nomme, une carte par rôle ; sinon, une ligne par rôle dans une seule carte. -->
{#snippet rolesDuCentre(roles: { id: number; nom: string; icone?: NomIcone; titulaires: Titulaire[]; demandes?: boolean }[])}
	{#if data.gestes}
		{#each roles as r (r.id)}<CarteRole titre={r.nom} postes={[posteDe(r.id, null)]} aujourdhui={data.aujourdhui} demande={data.peutDemander && r.demandes ? r.id : undefined} />{/each}
	{:else}
		<ul role="list" class="lignes">
			{#each roles as r (r.id)}{@render lu(r.nom, r.titulaires, r.icone, data.peutDemander && r.demandes ? r.id : undefined)}{/each}
		</ul>
	{/if}
{/snippet}

{#snippet commandement()}{@render rolesDuCentre(data.commandement.map((r) => ({ ...r, icone: undefined, demandes: false })))}{/snippet}
{#snippet fonctions()}{@render rolesDuCentre(data.fonctions)}{/snippet}
{#snippet missions()}{@render rolesDuCentre(data.missions)}{/snippet}

<div class="page">
	<EnTetePage titre="Qui fait quoi" retour={{ href: '/caserne', libelle: 'Caserne' }}>
		{#snippet secondaire()}
			<!-- Créer et régler les rôles et les comités (droits, qui nomme) : ce que les gestes de la page ne font pas. -->
			{#if data.peutReglages}<a class="lien-secondaire" href="/reglages">Régler les rôles et les comités</a>{/if}
		{/snippet}
	</EnTetePage>

	<div role="status">{#if annonce}<p class="succes">{annonce}</p>{/if}</div>

	{#if manquants.length > 0}
		<ListeRangees titre="À pourvoir" compte={manquants.length}>
			{#each manquants as p (p.cle)}
				<li>
					<Rangee titre={p.role} sous={p.perimetre.nom ?? undefined} alerte>
						{#snippet droite()}<a class="lien-secondaire ecrire" href={adresseVolet(page.url.searchParams, { nommer: p.cle })}>Nommer<span class="masque">{` (${intitule(p)})`}</span></a>{/snippet}
					</Rangee>
				</li>
			{/each}
		</ListeRangees>
	{/if}

	<div class="colonnes">
		<div class="colonne">
			{@render groupe('Comités', resume(pluriel(data.comites.length, 'comité'), postesDeComites), postesDeComites.map((p) => p.cle), comites)}
		</div>
		<div class="colonne">
			{#if data.commandement.length > 0}{@render groupe('Chef de centre et adjoint', resumeRoles(data.commandement), data.commandement.map((r) => cleDePoste(r.id, null)), commandement)}{/if}
			{#each fonctionsEquipe as r (r.id)}{@render parEquipe(r)}{/each}
			{#if data.fonctions.length > 0}{@render groupe('Autres rôles toujours tenus', resumeRoles(data.fonctions), data.fonctions.map((r) => cleDePoste(r.id, null)), fonctions)}{/if}
			{#if data.missions.length > 0}{@render groupe('Autres rôles', resumeRoles(data.missions), data.missions.map((r) => cleDePoste(r.id, null)), missions)}{/if}
			{#each missionsEquipe as r (r.id)}{@render parEquipe(r)}{/each}
		</div>
	</div>
</div>

{#if data.gestes}
	<Volets {postes} agents={data.gestes.agents} aujourdhui={data.aujourdhui} fiches={data.fiches} {form} onreussite={(m) => (reussite = m)} />
{/if}

<style>
	/* Plus serré qu'un lien de page : il tient dans la ligne, au téléphone aussi. */
	.ecrire {
		min-height: 40px;
		padding: 0 var(--espace-12);
		font-size: var(--texte-15);
	}
	.page,
	.colonne {
		display: flex;
		flex-direction: column;
		gap: var(--espace-16);
	}
	/* Une liste : la largeur d'une liste, centrée ; à l'ordinateur, les lignes ne s'étirent pas sur tout l'écran. */
	.page {
		gap: var(--espace-24);
		width: 100%;
		max-width: var(--largeur-liste);
		margin-inline: auto;
	}
	.colonnes {
		display: flex;
		flex-direction: column;
		gap: var(--espace-16);
	}
	/* Un groupe replié : son titre et son résumé, le chevron devant. */
	.groupe > summary {
		min-height: 56px;
	}
	.entete {
		display: flex;
		flex-direction: column;
	}
	.entete h2 {
		margin: 0;
	}
	.resume {
		color: var(--doux);
		font-weight: 400;
		font-size: var(--texte-15);
	}
	/* Laisser respirer : un espacement franc entre les cartes de rôle, comme entre deux groupes. */
	.contenu,
	.comite {
		display: flex;
		flex-direction: column;
		gap: var(--espace-24);
	}
	.contenu {
		padding-top: var(--espace-12);
		padding-bottom: var(--espace-12);
	}
	.comite {
		gap: var(--espace-16);
	}
	.comite > h3 {
		margin: 0;
	}
	/* Les parties d'une carte de comité. */
	.intertitre h4 {
		margin: 0;
		padding: var(--espace-12) var(--espace-16) var(--espace-4);
		font: 600 var(--texte-15)/1.2 var(--police-titre);
		color: var(--doux);
	}
	.intertitre + :global(li) {
		border-top: none;
	}
	/* La zone d'annonce vide ne creuse pas d'écart. */
	.page > div[role='status']:empty {
		margin-top: calc(-1 * var(--espace-24));
	}
	.succes {
		margin: 0;
		padding: var(--espace-12) var(--espace-16);
		border-radius: var(--rayon-petit);
		border: 2px solid var(--ok);
		font-weight: 600;
	}
</style>
