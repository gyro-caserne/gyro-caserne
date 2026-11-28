<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import { texteCreneau } from '@gyro-caserne/socle';
	import ListeCollegues from '#lib/remplacements/ListeCollegues.svelte';
	import Progression from '#lib/remplacements/Progression.svelte';
	import { etapes } from '#lib/remplacements/guide.ts';
	import { pluriel } from '#lib/pluriel.ts';
	import Bouton from '#lib/ui/Bouton.svelte';
	import Champ from '#lib/ui/Champ.svelte';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';

	let { data, form } = $props();
	// Après chaque étape, le clavier et le lecteur d'écran repartent du titre de l'étape.
	afterNavigate(({ type }) => {
		if (type !== 'enter') document.getElementById('titre-etape')?.focus();
	});
	const liste = etapes('remplacement');
	const index = $derived(liste.findIndex((e) => e.id === data.etape));
	const precedente = $derived(index > 0 ? liste[index - 1]!.id : null);
	const nom = (q: { prenom: string; nom: string }) => `${q.prenom} ${q.nom}`;

	// L'état du parcours, tel qu'il est dans l'adresse.
	function lienEtape(etape: string): string {
		const q = new URLSearchParams();
		if (etape !== 'quand') q.set('etape', etape);
		if (data.debut) q.set('debut', data.debut);
		if (data.fin) q.set('fin', data.fin);
		if (data.pour) q.set('pour', data.pour === 'tous' ? 'tous' : String(data.pour.id));
		return `?${q}`;
	}

	const texte = $derived(data.creneau ? texteCreneau(data.creneau) : '');
	const cible = $derived(data.pour && data.pour !== 'tous' ? data.pour : null);
	const informe = 'Votre chef de garde sera informé dès qu’un collègue accepte.';
	const personne = $derived(!cible && data.candidats.length === 0);
	const recap = $derived.by(() => {
		if (cible) return [`Vous demandez à ${nom(cible)} de vous remplacer ${texte}.`, `${cible.prenom} doit accepter.`, cible.manque.length > 0 ? `Il lui manque ${cible.manque.join(', ')}. Votre chef de garde devra valider.` : 'Votre chef de garde sera informé quand il aura accepté.'];
		const n = data.candidats.length;
		if (n === 0) return [`Vous voulez être remplacé ${texte}.`, 'Aucun collègue n’est libre sur ce créneau pour l’instant. Personne ne recevrait la demande.', 'Prévenez directement votre chef de garde.'];
		return [`Vous demandez à être remplacé ${texte}.`, `${pluriel(n, 'collègue disponible est prévenu', 'collègues disponibles sont prévenus')}.`, informe];
	});
	const message = $derived(form?.message ?? data.message ?? '');
</script>

<svelte:head>
	<title>{liste[index]?.titre}</title>
</svelte:head>

{#snippet garder(sauf: string[])}
	{#if data.creneau && !sauf.includes('creneau')}
		<input type="hidden" name="debut" value={data.creneau.debut} />
		<input type="hidden" name="fin" value={data.creneau.fin} />
	{/if}
	{#if data.pour && !sauf.includes('pour')}<input type="hidden" name="pour" value={data.pour === 'tous' ? 'tous' : data.pour.id} />{/if}
{/snippet}

{#snippet boutons(suivante: string)}
	<div class="boutons">
		<Bouton type="submit" name="etape" value={suivante}>Continuer</Bouton>
		{#if precedente}<a class="bouton-lien" href={lienEtape(precedente)}>Retour</a>{/if}
	</div>
{/snippet}

<div class="page">
	<EnTetePage titre="Un créneau" phrase="Le début et la fin, dans vos astreintes à venir. Vous vérifiez avant d’envoyer." retour={{ href: '/remplacements/demander', libelle: 'Me faire remplacer' }} />
	<Progression etapes={liste} courante={data.etape} lien={lienEtape} />
	<p class="erreur" class:masque={!message} role="alert">{message}</p>

	<section class="carte" aria-labelledby="titre-etape">
		<h2 id="titre-etape" tabindex="-1">{liste[index]?.titre}</h2>

		{#if data.etape === 'quand'}
			<p class="doux">Au moins 1 h, demandé au moins 1 h avant son début. Il peut courir sur deux astreintes qui se suivent.</p>
			<form method="GET" class="formulaire" data-sveltekit-reset="false">
				{@render garder(['creneau'])}
				<Champ id="debut" name="debut" type="datetime-local" libelle="Début" valeur={data.debut} requis />
				<Champ id="fin" name="fin" type="datetime-local" libelle="Fin" valeur={data.fin} requis />
				{@render boutons('qui')}
			</form>
		{:else}
			<p class="resume">
				<span>Votre créneau, <strong>{texte}</strong>.</span>
				<a href={lienEtape('quand')}>Modifier<span class="masque">{' le créneau'}</span></a>
			</p>
			{#if data.etape === 'qui'}
				<form method="GET" class="formulaire" data-sveltekit-reset="false">
					{@render garder(['pour'])}
					<ListeCollegues collegues={data.candidats} name="pour" choisi={data.pour === 'tous' ? 'tous' : (data.pour?.id ?? null)} recherche={data.recherche} etape="qui" tous={data.candidats.length} legende="Qui prévenir ?" sur="ce créneau" />
					{@render boutons('verifier')}
				</form>
			{:else}
				<div class="recap">
					{#each recap as phrase, i (i)}<p class:fort={i === 0}>{phrase}</p>{/each}
				</div>
				<form method="POST" class="formulaire">
					{@render garder([])}
					{#if !data.pour}<input type="hidden" name="pour" value="tous" />{/if}
					{#if !personne}<Champ id="mot" name="mot" libelle="Un mot pour {cible ? 'votre collègue' : 'vos collègues'} (facultatif)" maxlength={200} lignes={2} />{/if}
					<div class="boutons">
						{#if !personne}<Bouton type="submit">Envoyer la demande</Bouton>{/if}
						<a class="bouton-lien" href={lienEtape('qui')}>Retour</a>
					</div>
				</form>
			{/if}
		{/if}
	</section>
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--espace-16);
		max-width: var(--largeur-lecture);
		margin-inline: auto;
		width: 100%;
	}
	p,
	h2 {
		margin: 0;
	}
	h2 {
		font: 700 var(--texte-24) var(--police-titre);
	}
	h2:focus {
		outline: none;
	}
	.carte {
		display: flex;
		flex-direction: column;
		gap: var(--espace-16);
		padding: var(--espace-16);
		background: var(--surface);
		border: 1px solid transparent;
		box-shadow: var(--ombre-carte);
		border-radius: var(--rayon-grand);
	}
	.formulaire {
		display: flex;
		flex-direction: column;
		gap: var(--espace-16);
	}
	.doux {
		color: var(--doux);
	}
	.resume {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--espace-4) var(--espace-12);
		padding: var(--espace-12) var(--espace-16);
		border-radius: var(--rayon-grand);
		background: var(--statut-neutre-fond);
	}
	.resume a {
		color: var(--encre);
		font-weight: 600;
	}
	.recap {
		display: flex;
		flex-direction: column;
		gap: var(--espace-6);
		padding: var(--espace-16);
		border-radius: var(--rayon-grand);
		background: var(--statut-neutre-fond);
		font-size: var(--texte-16);
	}
	.fort {
		font-weight: 700;
	}
	.boutons {
		display: flex;
		flex-wrap: wrap;
		gap: var(--espace-8);
	}
	.bouton-lien {
		min-height: var(--cible);
		display: inline-flex;
		align-items: center;
		padding: 0 var(--espace-20);
		border: 1px solid var(--trait);
		border-radius: var(--rayon-bouton);
		background: var(--surface);
		color: var(--encre);
		font-weight: 700;
		text-decoration: none;
	}
	.erreur {
		padding: var(--espace-12) var(--espace-16);
		border-radius: var(--rayon-grand);
		font-weight: 600;
		background: var(--statut-danger-fond);
		color: var(--statut-danger-texte);
		border: 1px solid var(--statut-danger-trait);
	}
</style>
