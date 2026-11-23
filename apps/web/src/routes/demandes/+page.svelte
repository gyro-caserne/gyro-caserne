<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { extraitDemandeReferent, LIMITE_DEMANDE, type DemandeReferentListee } from '@gyro-caserne/socle';
	import { dateCourte } from '#lib/engins/textes.ts';
	import { etatDemandeReferent } from '#lib/demandes/textes.ts';
	import { pluriel } from '#lib/pluriel.ts';
	import Bouton from '#lib/ui/Bouton.svelte';
	import Carte from '#lib/ui/Carte.svelte';
	import Champ from '#lib/ui/Champ.svelte';
	import ChoixRadio from '#lib/ui/ChoixRadio.svelte';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';
	import ListeRangees from '#lib/ui/ListeRangees.svelte';
	import Pastille from '#lib/ui/Pastille.svelte';
	import Rangee from '#lib/ui/Rangee.svelte';
	import Vide from '#lib/ui/Vide.svelte';
	import type { IconeRole as NomIcone } from '#lib/ui/icones-roles.ts';

	type Role = { id: number; nom: string; icone: NomIcone };
	let {
		data,
		form
	}: {
		data: { roles: Role[]; recus: (Role & { enCours: number })[]; enCours: DemandeReferentListee[]; terminees: DemandeReferentListee[]; peutDemander: boolean; choisi: number | null };
		form: { texte?: string; role?: number; champ?: string; message?: string } | null;
	} = $props();
	let envoi = $state(false);
	// Le rôle choisi : celui de l'adresse, ou celui renvoyé après un refus (posé dès le rendu du serveur, pour marcher sans JavaScript).
	const depart = () => String(form?.role || data.choisi || '');
	let role = $state(untrack(depart));
	$effect.pre(() => {
		role = depart();
	});
	const quand = (d: DemandeReferentListee) => (d.finLe ? `${d.role}, finie le ${dateCourte(d.finLe)}` : `${d.role}, demandée le ${dateCourte(d.creeLe)}`);
</script>

<svelte:head>
	<title>Faire une demande</title>
</svelte:head>

{#snippet ligne(d: DemandeReferentListee)}
	{@const etat = etatDemandeReferent(d)}
	<li>
		<Rangee href="/demandes/{d.id}" titre={extraitDemandeReferent(d.texte)} sous={quand(d)}>
			{#snippet droite()}<Pastille ton={etat.ton}>{etat.texte}</Pastille>{/snippet}
		</Rangee>
	</li>
{/snippet}

<div class="page">
	<EnTetePage titre="Faire une demande" retour={{ href: '/caserne', libelle: 'Caserne' }} />

	<div class="colonnes">
		<Carte titre="Nouvelle demande">
			{#if !data.peutDemander}
				<p>Les demandes sont réservées aux agents du centre.</p>
			{:else if data.roles.length === 0}
				<p>Aucun référent ne reçoit de demandes pour l’instant. Le chef de centre le règle dans Réglages, sur la page de chaque rôle.</p>
			{:else}
				<form
					method="POST"
					use:enhance={() => {
						envoi = true;
						return async ({ update }) => {
							await update();
							envoi = false;
						};
					}}
				>
					<ChoixRadio id="role" name="role" legende="À qui ?" options={data.roles.map((r) => ({ valeur: String(r.id), libelle: r.nom, icone: r.icone }))} bind:valeur={role} disposition="rangees" requis erreur={form?.champ === 'role' ? form.message : undefined} />
					<Champ id="texte" name="texte" libelle="Votre demande" lignes={4} requis maxlength={LIMITE_DEMANDE} valeur={form?.texte ?? ''} aide="Ce qu’il vous faut, combien et pourquoi. Par exemple, des compresses stériles pour le VSAV, la boîte est vide." erreur={form?.champ === 'texte' ? form.message : undefined} />
					<div><Bouton type="submit" desactive={envoi}>Envoyer la demande</Bouton></div>
				</form>
			{/if}
		</Carte>

		<div class="listes">
			{#if data.recus.length}
				<ListeRangees titre="Demandes reçues">
					{#each data.recus as r (r.id)}
						<li><Rangee href="/demandes/role/{r.id}" icone={r.icone} titre={r.nom} valeur={r.enCours ? pluriel(r.enCours, 'en cours', 'en cours') : undefined} /></li>
					{/each}
				</ListeRangees>
			{/if}
			{#if data.enCours.length === 0 && data.terminees.length === 0}
				<Vide titre="Aucune demande" texte="Vos demandes aux référents et leur suivi s’afficheront ici." gyro={data.recus.length === 0} />
			{:else}
				{#if data.enCours.length}
					<ListeRangees titre="Mes demandes en cours" compte={data.enCours.length}>
						{#each data.enCours as d (d.id)}{@render ligne(d)}{/each}
					</ListeRangees>
				{/if}
				{#if data.terminees.length}
					<ListeRangees titre="Terminées">
						{#each data.terminees as d (d.id)}{@render ligne(d)}{/each}
					</ListeRangees>
				{/if}
			{/if}
		</div>
	</div>
</div>

<style>
	.page,
	.colonnes,
	.listes,
	form {
		display: flex;
		flex-direction: column;
		gap: var(--espace-20);
	}
	p {
		margin: 0;
	}
	@media (min-width: 1024px) {
		.colonnes {
			display: grid;
			grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
			align-items: start;
			gap: var(--espace-32);
		}
	}
</style>
