<script lang="ts">
	import { extraitDemandeReferent, type DemandeReferentListee, type ReglageDemandes } from '@gyro-caserne/socle';
	import { dateCourte } from '#lib/engins/textes.ts';
	import ReglageEtapes from '#lib/demandes/ReglageEtapes.svelte';
	import { etatDemandeReferent } from '#lib/demandes/textes.ts';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';
	import IconeRole from '#lib/ui/IconeRole.svelte';
	import ListeRangees from '#lib/ui/ListeRangees.svelte';
	import Pastille from '#lib/ui/Pastille.svelte';
	import Rangee from '#lib/ui/Rangee.svelte';
	import Vide from '#lib/ui/Vide.svelte';
	import type { IconeRole as NomIcone } from '#lib/ui/icones-roles.ts';

	let {
		data,
		form
	}: {
		data: { role: { id: number; nom: string; icone: NomIcone; demandes: ReglageDemandes | null }; titulaire: boolean; sansTitulaire: boolean; enCours: DemandeReferentListee[]; terminees: DemandeReferentListee[]; regler: 'tout' | 'etapes' | null };
		form: { cible?: string; succes?: string; message?: string } | null;
	} = $props();
	// Le demandeur, puis qui la suit (ou la date de fin).
	const sousLigne = (d: DemandeReferentListee) => [d.demandeur, d.finLe ? `finie le ${dateCourte(d.finLe)}` : d.prisePar ? `suivie par ${d.prisePar}` : `le ${dateCourte(d.creeLe)}`].join(', ');
</script>

<svelte:head>
	<title>Demandes reçues ({data.role.nom})</title>
</svelte:head>

{#snippet ligne(d: DemandeReferentListee)}
	{@const etat = etatDemandeReferent(d)}
	<li>
		<Rangee href="/demandes/{d.id}" titre={extraitDemandeReferent(d.texte)} sous={sousLigne(d)}>
			{#snippet droite()}<Pastille ton={etat.ton}>{etat.texte}</Pastille>{/snippet}
		</Rangee>
	</li>
{/snippet}

<div class="page">
	<EnTetePage titre="Demandes reçues" phrase={data.role.nom} retour={{ href: '/demandes', libelle: 'Faire une demande' }}>
		{#snippet tete()}<IconeRole icone={data.role.icone} taille={48} />{/snippet}
	</EnTetePage>
	{#if data.sansTitulaire}<p class="doux">Ce rôle n’a pas de titulaire. Le chef de centre et son adjoint reçoivent ses demandes.</p>{/if}

	{#if data.enCours.length === 0 && data.terminees.length === 0}
		<Vide titre="Aucune demande" texte="Les demandes des agents arriveront ici, et dans votre casquette sur l’Accueil." />
	{:else}
		<div class="colonnes">
			<ListeRangees titre="En cours" compte={data.enCours.length}>
				{#each data.enCours as d (d.id)}{@render ligne(d)}{:else}<li><Rangee titre="Aucune demande en cours" discret /></li>{/each}
			</ListeRangees>
			{#if data.terminees.length}
				<ListeRangees titre="Terminées">
					{#each data.terminees as d (d.id)}{@render ligne(d)}{/each}
				</ListeRangees>
			{/if}
		</div>
	{/if}

	{#if data.regler && data.role.demandes}
		<!-- Ouvert après chaque envoi : chaque geste recharge la page. -->
		<details class="plus" {...form?.cible === 'demandes' ? { open: true } : {}}>
			<summary>Régler les étapes</summary>
			<div class="reglage">
				<ReglageEtapes reglage={data.role.demandes} peutCocher={false} action="?/demandes" {form} />
			</div>
		</details>
	{/if}
</div>

<style>
	.page,
	.colonnes {
		display: flex;
		flex-direction: column;
		gap: var(--espace-24);
	}
	.doux {
		margin: 0;
		color: var(--doux);
	}
	.reglage {
		padding-top: var(--espace-16);
	}
	@media (min-width: 1024px) {
		.colonnes {
			display: grid;
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
			align-items: start;
			gap: var(--espace-32);
		}
	}
</style>
