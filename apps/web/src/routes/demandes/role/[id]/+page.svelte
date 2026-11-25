<script lang="ts">
	import { extraitDemandeReferent, type DemandeReferentListee, type ReglageDemandes } from '@gyro-caserne/socle';
	import { dateCourte } from '#lib/engins/textes.ts';
	import ReglageEtapes from '#lib/demandes/ReglageEtapes.svelte';
	import { etapesEnUneLigne, etatDemandeReferent } from '#lib/demandes/textes.ts';
	import Bouton from '#lib/ui/Bouton.svelte';
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
		form: { cible?: string; succes?: string; message?: string; demandes?: { recoit: boolean; etapes: { id?: string; nom: string }[]; derniere: string } } | null;
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
	<!-- En tête, pour qui règle : les étapes actuelles, et leur réglage qui se déplie sur place (ouvert après chaque envoi). -->
	{#if data.regler && data.role.demandes}
		<section class="etapes" aria-labelledby="titre-etapes">
			<h2 id="titre-etapes" class="rubrique">Étapes de vos demandes</h2>
			<p class="doux">{etapesEnUneLigne(data.role.demandes)}</p>
			<details class="plus" {...form?.cible === 'demandes' ? { open: true } : {}}>
				<summary>Régler les étapes</summary>
				<form method="POST" action="?/demandes" class="reglage">
					<div role="alert">{#if form?.message}<p class="echec">{form.message}</p>{/if}</div>
					<div role="status">{#if form?.succes}<p class="succes">{form.succes}</p>{/if}</div>
					<ReglageEtapes saisie={form?.demandes ?? { recoit: true, etapes: data.role.demandes.etapes, derniere: data.role.demandes.derniere }} peutCocher={false} apercu="?/apercu" />
					<div><Bouton type="submit">Enregistrer les étapes</Bouton></div>
				</form>
			</details>
		</section>
	{/if}
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
	.etapes {
		display: flex;
		flex-direction: column;
		gap: var(--espace-12);
		padding: var(--espace-16);
		background: var(--surface);
		border: 1px solid transparent;
		box-shadow: var(--ombre-carte);
		border-radius: var(--rayon-grand);
	}
	.etapes .plus[open] > summary {
		margin-bottom: 0;
	}
	.reglage {
		display: flex;
		flex-direction: column;
		gap: var(--espace-16);
		padding-top: var(--espace-16);
	}
	.echec,
	.succes {
		margin: 0;
		padding: var(--espace-12) var(--espace-16);
		border-radius: var(--rayon-petit);
		border: 2px solid var(--accent);
		font-weight: 600;
	}
	.succes {
		border-color: var(--ok);
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
