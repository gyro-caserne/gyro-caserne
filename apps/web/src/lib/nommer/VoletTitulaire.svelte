<script lang="ts">
	import { enhance } from '$app/forms';
	import { ajouterJours } from '@gyro-caserne/socle/dates';
	import { dateCourte } from '#lib/engins/textes.ts';
	import Panneau from '#lib/planning/Panneau.svelte';
	import Bouton from '#lib/ui/Bouton.svelte';
	import Champ from '#lib/ui/Champ.svelte';
	import Choix from '#lib/ui/Choix.svelte';
	import { agentsPour, intitule, type Agent, type Poste } from './postes.ts';
	import { surEnvoi } from './envoi.svelte.ts';

	// Le volet de la personne : son rôle et depuis quand ; « Remplacer » d'abord, « Finir le mandat » (grave, confirmé) sous « Plus ».
	type Reponse = { cible?: string; message?: string; erreurs?: Record<string, string>; valeurs?: Record<string, string> } | null | undefined;
	type Titulaire = Poste['titulaires'][number] & { mandat: NonNullable<Poste['titulaires'][number]['mandat']> };
	let {
		poste,
		titulaire: t,
		agents,
		aujourdhui,
		fiches,
		fermer,
		form,
		onreussite
	}: { poste: Poste; titulaire: Titulaire; agents: Agent[]; aujourdhui: string; fiches: boolean; fermer: string; form: Reponse; onreussite: (message: string) => void } = $props();

	const m = $derived(t.mandat);
	const aVenir = $derived(m.debut > aujourdhui);
	const quand = $derived([aVenir ? `À partir du ${dateCourte(m.debut)}` : `Depuis le ${dateCourte(m.debut)}`, m.fin ? `jusqu’au ${dateCourte(m.fin)}` : ''].filter(Boolean).join(', '));
	const refus = $derived(form?.cible === `mandat-${m.id}` ? form : null);
	const erreurs = $derived(refus?.erreurs ?? {});
	// « Plus » s'ouvre sur un refus de la fin du mandat.
	const plusOuvert = $derived(Boolean(erreurs.fin || erreurs.confirmation));
	// Le remplaçant commence au plus tôt aujourd'hui, et toujours après le début du mandat.
	const debutPropose = $derived(m.debut < aujourdhui ? aujourdhui : ajouterJours(m.debut, 1));
	const options = $derived(agentsPour(agents, poste, [t.id]).map((a) => ({ valeur: String(a.id), libelle: a.equipe ? `${a.nom} (${a.equipe})` : a.nom })));
	const etat = surEnvoi(() => fermer, onreussite);
</script>

<Panneau titre={t.nom} {fermer}>
	<div class="volet">
		<div>
			<p class="poste">{intitule(poste)}</p>
			<p class="doux">{quand}</p>
		</div>
		<div role="alert">{#if refus?.message}<p class="echec">{refus.message}</p>{/if}</div>

		<form method="POST" action="?/remplacer" class="formulaire" use:enhance={etat.soumettre}>
			<h3>Remplacer</h3>
			<input type="hidden" name="attributionId" value={m.id} />
			<Choix id="remplacant-{m.id}" name="personneId" libelle="Nouveau titulaire" valeur={refus?.valeurs?.personneId ?? ''} options={[{ valeur: '', libelle: 'Choisissez un agent' }, ...options]} erreur={erreurs.personneId} />
			<Champ id="debut-{m.id}" name="debut" type="date" libelle="À partir du" requis valeur={refus?.valeurs?.debut ?? debutPropose} erreur={erreurs.debut} aide="Le mandat de {t.nom} finira la veille." />
			<div><Bouton type="submit" desactive={etat.envoi}>Remplacer</Bouton></div>
		</form>

		{#if fiches || t.ecrire}
			<div class="liens">
				{#if fiches}<a class="lien-secondaire" href="/agents/{t.id}">Voir sa fiche</a>{/if}
				{#if t.ecrire}<a class="lien-secondaire" href="/echanges/messages/a/{t.id}">Écrire<span class="masque">{` à ${t.nom}`}</span></a>{/if}
			</div>
		{/if}

		<details class="plus" {...plusOuvert ? { open: true } : {}}>
			<summary>Plus</summary>
			{#if aVenir}
				<form method="POST" action="?/terminer" class="formulaire" use:enhance={etat.soumettre}>
					<input type="hidden" name="attributionId" value={m.id} />
					<p>La nomination de {t.nom} est annulée. Le mandat ne commencera pas.</p>
					<label class="case"><input type="checkbox" name="confirmation" value="oui" aria-invalid={erreurs.confirmation ? 'true' : undefined} /> Je confirme</label>
					{#if erreurs.confirmation}<p class="erreur">{erreurs.confirmation}</p>{/if}
					<div><Bouton type="submit" variante="grave" desactive={etat.envoi}>Annuler la nomination</Bouton></div>
				</form>
			{:else}
				<form method="POST" action="?/finir" class="formulaire" use:enhance={etat.soumettre}>
					<input type="hidden" name="attributionId" value={m.id} />
					<Champ id="fin-{m.id}" name="fin" type="date" libelle="Dernier jour du mandat" requis valeur={refus?.valeurs?.fin ?? aujourdhui} erreur={erreurs.fin} aide="{t.nom} perd ce rôle, et ses droits, après ce jour." />
					<label class="case"><input type="checkbox" name="confirmation" value="oui" aria-invalid={erreurs.confirmation ? 'true' : undefined} /> Je confirme</label>
					{#if erreurs.confirmation}<p class="erreur">{erreurs.confirmation}</p>{/if}
					<div><Bouton type="submit" variante="grave" desactive={etat.envoi}>Finir le mandat</Bouton></div>
				</form>
			{/if}
		</details>
	</div>
</Panneau>

<style>
	.volet,
	.formulaire {
		display: flex;
		flex-direction: column;
		gap: var(--espace-16);
	}
	.volet {
		gap: var(--espace-20);
	}
	p,
	h3 {
		margin: 0;
	}
	h3 {
		font: 700 var(--texte-18) var(--police-titre);
	}
	.poste {
		font-weight: 600;
	}
	.doux {
		color: var(--doux);
	}
	.liens {
		display: flex;
		flex-wrap: wrap;
		gap: var(--espace-12);
	}
	.plus .formulaire {
		padding-top: var(--espace-12);
	}
	.case {
		display: flex;
		align-items: center;
		gap: var(--espace-12);
		min-height: var(--cible);
	}
	.erreur {
		color: var(--accent);
		font-weight: 600;
	}
	.echec {
		padding: var(--espace-12) var(--espace-16);
		border-radius: var(--rayon-petit);
		border: 2px solid var(--accent);
		font-weight: 600;
	}
</style>
