<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import type { VueHoraires } from '@gyro-caserne/socle';
	import Bouton from '#lib/ui/Bouton.svelte';
	import Champ from '#lib/ui/Champ.svelte';
	import Choix from '#lib/ui/Choix.svelte';
	import Interrupteur from '#lib/ui/Interrupteur.svelte';
	import ListeRangees from '#lib/ui/ListeRangees.svelte';
	import Rangee from '#lib/ui/Rangee.svelte';
	import { jourLong } from './dates.ts';
	import { enHeure, JOURS_RELEVE, lignesHoraires, phraseHoraires } from './horaires.ts';

	// Les horaires de garde de l'année, à l'étape Roulement : modifiables tant que l'année n'est pas publiée, en lecture seule ensuite.
	// `premiere` : le jour de la première relève de l'année ; `action` : l'adresse d'une action de la page.
	let { horaires, annee, publiee, premiere, action }: { horaires: VueHoraires; annee: number; publiee: boolean; premiere: string | null; action: (nom: string) => string } = $props();

	const h = $derived(horaires.valeur);
	// Revient aux horaires enregistrés après chaque enregistrement.
	let continu = $state(untrack(() => !horaires.valeur.semaine));
	$effect.pre(() => {
		continu = !horaires.valeur.semaine;
	});
	const jours = JOURS_RELEVE.map((j) => ({ valeur: j, libelle: `${j[0]!.toUpperCase()}${j.slice(1)}` }));
	const garder = () => async ({ update }: { update: (o?: { reset?: boolean }) => Promise<void> }) => update({ reset: false });
	// Une autre relève que l'année d'avant : sa dernière semaine court jusqu'à la première de celle-ci.
	const autreReleve = $derived(horaires.precedente.debut.jour !== h.debut.jour || horaires.precedente.debut.heure !== h.debut.heure);
</script>

<section class="horaires" aria-labelledby="titre-horaires">
	<h3 id="titre-horaires">Horaires de garde</h3>
	{#if publiee}
		<p class="doux">Année publiée. Ses horaires ne changent plus.</p>
		<ListeRangees>
			{#each lignesHoraires(h) as l (l.titre)}<li><Rangee titre={l.titre} valeur={l.valeur} /></li>{/each}
		</ListeRangees>
	{:else}
		<form method="POST" action={action('horaires')} class="formulaire" use:enhance={garder}>
			<div class="deux">
				<Choix id="horaires-jour" name="jour" libelle="Jour de la relève" options={jours} valeur={h.debut.jour} requis />
				<Champ id="horaires-releve" name="releve" type="time" libelle="Heure de la relève" valeur={h.debut.heure} requis />
			</div>
			<div class="deux">
				<Champ id="horaires-fin" name="fin" type="time" libelle="Fin de l’astreinte" aide="Le jour de la relève suivante." valeur={h.fin.heure} requis />
			</div>
			<Interrupteur libelle="Astreinte continue toute la semaine" description="Sans heures de semaine, de la relève à la fin." nom="continue" bind:coche={continu} />
			{#if !continu}
				<div class="deux">
					<Champ id="horaires-semaine-debut" name="semaine-debut" type="time" libelle="Début en semaine" valeur={h.semaine?.debut ?? '18:00'} requis />
					<Champ id="horaires-semaine-fin" name="semaine-fin" type="time" libelle="Fin en semaine" valeur={h.semaine?.fin ?? '06:00'} requis />
				</div>
				<p class="doux">Le week-end et les jours fériés, l’astreinte est continue.</p>
			{/if}
			{#if autreReleve && premiere}
				<p class="doux">La dernière semaine de {annee - 1} court jusqu’à la première relève de {annee}, le {jourLong(premiere)} à {enHeure(h.debut.heure)}.</p>
			{/if}
			<div><Bouton type="submit">Enregistrer les horaires</Bouton></div>
		</form>
		{#if horaires.propres}
			<form method="POST" action={action('horairesDuCentre')} class="centre" use:enhance={garder}>
				<p class="doux">Ceux du centre. {phraseHoraires(horaires.centre)}</p>
				<div><Bouton type="submit" variante="secondaire">Garder les horaires du centre</Bouton></div>
			</form>
		{/if}
	{/if}
</section>

<style>
	.horaires,
	.formulaire,
	.centre {
		display: flex;
		flex-direction: column;
		gap: var(--espace-12);
	}
	.formulaire {
		gap: var(--espace-16);
	}
	h3 {
		margin: 0;
		font: 700 var(--texte-18) var(--police-titre);
	}
	p {
		margin: 0;
	}
	.doux {
		color: var(--doux);
	}
	.deux {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--espace-12);
	}
	@media (min-width: 640px) {
		.deux {
			max-width: var(--largeur-lecture);
		}
	}
</style>
