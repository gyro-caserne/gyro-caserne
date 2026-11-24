<script lang="ts">
	import Panneau from '#lib/planning/Panneau.svelte';
	import Bouton from '#lib/ui/Bouton.svelte';
	import Champ from '#lib/ui/Champ.svelte';
	import Choix from '#lib/ui/Choix.svelte';
	import { agentsPour, intitule, simple, type Agent, type Poste } from './postes.ts';
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';
	import { surEnvoi } from './envoi.svelte.ts';

	// Le volet « Nommer », le même partout : l'agent (ceux de l'équipe d'abord, recherche par nom) et la date de début.
	type Reponse = { cible?: string; message?: string; erreurs?: Record<string, string>; valeurs?: Record<string, string> } | null | undefined;
	let { poste, agents, aujourdhui, fermer, form, onreussite }: { poste: Poste; agents: Agent[]; aujourdhui: string; fermer: string; form: Reponse; onreussite: (message: string) => void } = $props();

	const cible = $derived(`nommer-${poste.cle}`);
	const refus = $derived(form?.cible === cible ? form : null);
	const erreurs = $derived(refus?.erreurs ?? {});
	const proposes = $derived(agentsPour(agents, poste, poste.titulaires.map((t) => t.id)));
	let recherche = $state('');
	let choisi = $state(refus?.valeurs?.personneId ?? '');
	// La recherche réduit la liste ; l'agent déjà choisi y reste.
	const options = $derived(
		proposes.filter((a) => String(a.id) === choisi || simple(a.nom).includes(simple(recherche))).map((a) => ({ valeur: String(a.id), libelle: a.equipe ? `${a.nom} (${a.equipe})` : a.nom }))
	);
	const etat = surEnvoi(() => fermer, onreussite);
	// La recherche ne sert qu'avec JavaScript : sans lui, la liste entière.
	let monte = $state(false);
	onMount(() => (monte = true));
</script>

<Panneau titre="Nommer" {fermer}>
	<form method="POST" action="?/nommer" class="volet" use:enhance={etat.soumettre}>
		<p class="poste">{intitule(poste)}</p>
		<div role="alert">{#if refus && (refus.message || refus.erreurs)}<p class="echec">{refus.message ?? 'Le formulaire contient des erreurs.'}</p>{/if}</div>
		<input type="hidden" name="poste" value={poste.cle} />
		<input type="hidden" name="responsabiliteId" value={poste.roleId} />
		<input type="hidden" name="perimetre" value={poste.perimetre.id ?? 'centre'} />
		{#if monte}<Champ id="chercher-{poste.cle}" name="recherche" type="search" libelle="Rechercher par nom" bind:valeur={recherche} />{/if}
		<Choix id="agent-{poste.cle}" name="personneId" libelle="Agent" bind:valeur={choisi} options={[{ valeur: '', libelle: 'Choisissez un agent' }, ...options]} erreur={erreurs.personneId} />
		<Champ id="debut-{poste.cle}" name="debut" type="date" libelle="À partir du" requis valeur={refus?.valeurs?.debut ?? aujourdhui} erreur={erreurs.debut ?? erreurs.perimetreId ?? erreurs.responsabiliteId} />
		<div><Bouton type="submit" desactive={etat.envoi}>Nommer</Bouton></div>
	</form>
</Panneau>

<style>
	.volet {
		display: flex;
		flex-direction: column;
		gap: var(--espace-16);
	}
	.poste {
		margin: 0;
		font-weight: 600;
	}
	.echec {
		margin: 0;
		padding: var(--espace-12) var(--espace-16);
		border-radius: var(--rayon-petit);
		border: 2px solid var(--accent);
		font-weight: 600;
	}
</style>
