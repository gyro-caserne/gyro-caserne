<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance, type SubmitFunction } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { extraitDemandeReferent, LIMITE_DEMANDE, type QuoiGesteDemande, type VueDemandeReferent } from '@gyro-caserne/socle';
	import { dateCourte, heureCourte } from '#lib/engins/textes.ts';
	import { etatDemandeReferent, texteDuFil } from '#lib/demandes/textes.ts';
	import Panneau from '#lib/planning/Panneau.svelte';
	import Bouton from '#lib/ui/Bouton.svelte';
	import Carte from '#lib/ui/Carte.svelte';
	import Champ from '#lib/ui/Champ.svelte';
	import ChoixRadio from '#lib/ui/ChoixRadio.svelte';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';
	import IconeRole from '#lib/ui/IconeRole.svelte';
	import Pastille from '#lib/ui/Pastille.svelte';
	import type { IconeRole as NomIcone } from '#lib/ui/icones-roles.ts';

	type Reponse = { quoi?: string | null; succes?: string; message?: string } | null;
	let { data, form }: { data: { demande: Omit<VueDemandeReferent, 'icone'> & { icone: NomIcone }; envoyee?: boolean }; form: Reponse } = $props();

	const d = $derived(data.demande);
	const peut = (quoi: QuoiGesteDemande) => d.gestes.includes(quoi);
	const etat = $derived(etatDemandeReferent(d));
	const arretee = $derived(d.etape === 'refusee' || d.etape === 'annulee');
	// Le rang de l'étape actuelle dans le suivi ; refusée ou annulée : les étapes franchies d'après le fil.
	const rang = $derived(arretee ? d.franchie + 1 : d.etape === 'faite' ? d.etapes.length : Math.max(0, d.etapes.findIndex((e) => e.id === d.etape)));
	const etapeDe = (i: number) => (i < rang ? 'faite' : arretee ? 'a-venir' : i === rang ? 'en-cours' : 'a-venir');
	const LUS: Record<string, string> = { faite: 'faite', 'en-cours': 'en cours', 'a-venir': 'à venir' };
	const moment = (le: string) => `${dateCourte(le)}, ${heureCourte(le)}`;
	// La question en attente de l'agent : rappelée dans le suivi, avec un lien vers la réponse.
	const question = $derived(d.question === 'posee' ? d.fil.findLast((f) => f.quoi === 'question') : undefined);
	const gestionnaire = $derived(d.gestes.some((g) => g !== 'repondre' && g !== 'annuler') || !d.sienne);

	// Un seul envoi à la fois ; le message de réussite est gardé (la navigation qui ferme un panneau efface `form`).
	let envoi = $state(false);
	let reussite = $state('');
	let message = $state('');
	const soumettre: SubmitFunction = ({ formElement }) => {
		envoi = true;
		reussite = '';
		const ouvert = panneau;
		return async ({ update, result }) => {
			await update({ navigate: false, reset: result.type === 'success' });
			envoi = false;
			if (result.type === 'success') {
				reussite = String(result.data?.succes ?? '');
				message = '';
				// Le panneau se ferme, le bandeau « Demande envoyée » part.
				if (ouvert || data.envoyee) await goto(sans, { replaceState: true, reset: false });
				document.getElementById('titre-suivi')?.focus();
			}
			formElement.querySelector('textarea')?.blur();
		};
	};

	// Poser une question, avancer, refuser, annuler : un panneau chacun, ouvert par l'adresse (`?panneau=`) ou rouvert par un refus.
	const PANNEAUX = ['question', 'avancer', 'refuser', 'annuler'] as const;
	type Cle = (typeof PANNEAUX)[number];
	const TITRES: Record<Cle, string> = { question: 'Poser une question', avancer: 'Faire avancer', refuser: 'Refuser la demande', annuler: 'Annuler la demande' };
	// Les panneaux des gestes du référent ; « Annuler » est à part, pour l'agent.
	const REFERENT = PANNEAUX.filter((c) => c !== 'annuler');
	const adresse = (cle: Cle | null) => {
		const p = new URLSearchParams(page.url.search);
		p.delete('envoyee');
		if (cle) p.set('panneau', cle);
		else p.delete('panneau');
		return `?${p}`;
	};
	const sans = $derived(adresse(null));
	const panneau = $derived.by((): Cle | null => {
		const demande = form?.message && PANNEAUX.find((c) => c === form?.quoi) ? (form.quoi as Cle) : PANNEAUX.find((c) => c === page.url.searchParams.get('panneau'));
		return demande && peut(demande) ? demande : null;
	});
	// Vers l'étape suivante par défaut ; la dernière dit qu'elle finit la demande.
	let vers = $state(untrack(() => data.demande.vers[0]?.id ?? ''));
	$effect.pre(() => {
		vers = d.vers[0]?.id ?? '';
	});
	const OPTIONS_VERS = $derived(d.vers.map((v) => ({ valeur: v.id, libelle: v.nom, sous: v.id === 'faite' ? 'La demande est finie' : undefined })));
</script>

<svelte:head>
	<title>{extraitDemandeReferent(d.texte, 40)}</title>
</svelte:head>

{#snippet erreur(quoi: string)}
	{#if form?.message && form.quoi === quoi}<p class="echec" role="alert">{form.message}</p>{/if}
{/snippet}

<div class="page">
	<EnTetePage titre={extraitDemandeReferent(d.texte, 60)} phrase={d.sienne ? d.role : `Demandée par ${d.demandeur} (${d.role})`} retour={d.sienne ? { href: '/demandes', libelle: 'Faire une demande' } : { href: `/demandes/role/${d.roleId}`, libelle: 'Demandes reçues' }}>
		{#snippet tete()}<IconeRole icone={d.icone} taille={40} />{/snippet}
	</EnTetePage>

	<div role="status" class="masque">{form?.succes ?? reussite}</div>
	{#if data.envoyee}<p class="bandeau ok">Demande envoyée. Vous serez prévenu à chaque étape.</p>{/if}
	{#if form?.message && form.quoi === null}<p class="echec" role="alert">{form.message}</p>{/if}
	<!-- Refus d'un geste devenu impossible entre-temps : son panneau ne s'ouvre plus, le message reste lu. -->
	{#if form?.message && !panneau && PANNEAUX.some((c) => c === form?.quoi)}<p class="echec" role="alert">{form.message}</p>{/if}

	<div class="colonnes">
		<Carte titre="Suivi" ancre="titre-suivi">
			<div class="contenu">
				<div><Pastille ton={etat.ton}>{etat.texte}</Pastille></div>
				<ol class="etapes">
					{#each d.etapes as e, i (e.id)}
						<li class={etapeDe(i)} aria-current={etapeDe(i) === 'en-cours' ? 'step' : undefined}>
							<span class="puce" aria-hidden="true">{#if etapeDe(i) === 'faite'}<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7" /></svg>{/if}</span>
							<span>{e.nom}<span class="masque">{', '}{LUS[etapeDe(i)]}</span></span>
						</li>
					{/each}
				</ol>
				{#if arretee}<p><strong>{etat.texte}</strong> le {dateCourte(d.finLe ?? d.majLe)}.</p>{/if}
				{#if d.mot}<p><strong>{d.mot}</strong></p>{/if}
				<p class="doux">{d.prisePar ? `Suivie par ${d.prisePar}.` : arretee ? '' : `En attente d’un titulaire du rôle ${d.role}.`}</p>
				{#if question && peut('repondre')}
					<div class="question">
						<p><strong>{question.par} vous demande</strong></p>
						<p>{question.texte}</p>
						<div><a class="lien-secondaire" href="#texte-repondre">Répondre</a></div>
					</div>
				{/if}

				{#if peut('prendre') || peut('reprendre') || REFERENT.some(peut)}
					<div class="gestes">
						{#if peut('prendre') || peut('reprendre')}
							<form method="POST" use:enhance={soumettre}>
								<input type="hidden" name="quoi" value={peut('prendre') ? 'prendre' : 'reprendre'} />
								<Bouton type="submit" desactive={envoi}>{peut('prendre') ? 'Je la prends en compte' : 'Je la reprends'}</Bouton>
							</form>
						{/if}
						{#each REFERENT.filter(peut) as cle (cle)}<a class="lien-secondaire" href={adresse(cle)} data-sveltekit-noscroll data-sveltekit-reset="false">{TITRES[cle]}</a>{/each}
					</div>
					{@render erreur('prendre')}
					{@render erreur('reprendre')}
				{/if}
				{#if peut('annuler')}
					<div><a class="lien-secondaire" href={adresse('annuler')} data-sveltekit-noscroll data-sveltekit-reset="false">Annuler ma demande</a></div>
				{/if}
			</div>
		</Carte>

		<Carte titre="Le fil">
			<div class="contenu">
				<ol class="fil">
					<li>
						<strong>Demande</strong>
						<span class="doux">{moment(d.creeLe)}, par {d.demandeur}</span>
						<span class="texte">{d.texte}</span>
					</li>
					{#each d.fil as f, i (i)}
						<li>
							<strong>{texteDuFil(f)}</strong>
							<span class="doux">{moment(f.le)}, par {f.par}</span>
							{#if f.texte}<span class="texte">{f.texte}</span>{/if}
						</li>
					{/each}
				</ol>
				{#if peut('repondre')}
					<form method="POST" use:enhance={soumettre} class="formulaire">
						<input type="hidden" name="quoi" value="repondre" />
						<Champ id="texte-repondre" name="texte" lignes={3} requis maxlength={LIMITE_DEMANDE} bind:valeur={message} libelle={d.question === 'posee' ? 'Votre réponse' : 'Ajouter une précision'} erreur={form?.quoi === 'repondre' ? form.message : undefined} />
						<div><Bouton type="submit" desactive={envoi}>Envoyer</Bouton></div>
					</form>
				{:else if !gestionnaire && !d.gestes.length && !['faite', 'refusee', 'annulee'].includes(d.etape)}
					<p class="doux">Le référent vous répondra ici.</p>
				{/if}
			</div>
		</Carte>
	</div>
</div>

{#if panneau}
	<Panneau titre={TITRES[panneau]} fermer={sans}>
		<form method="POST" action={sans} use:enhance={soumettre} class="formulaire">
			<input type="hidden" name="quoi" value={panneau} />
			{#if panneau === 'question'}
				<Champ id="texte-question" name="texte" lignes={3} requis maxlength={LIMITE_DEMANDE} libelle="Votre question" aide="Par exemple, quelle taille ?" erreur={form?.quoi === 'question' ? form.message : undefined} />
				<div><Bouton type="submit" desactive={envoi}>Envoyer la question</Bouton></div>
			{:else if panneau === 'avancer'}
				<ChoixRadio id="vers" name="vers" legende="Étape" options={OPTIONS_VERS} bind:valeur={vers} disposition="rangees" requis />
				<Champ id="texte-avancer" name="texte" lignes={2} maxlength={LIMITE_DEMANDE} libelle="Un mot pour l’agent (facultatif)" aide={vers === 'faite' ? 'Par exemple, dans votre casier.' : undefined} erreur={form?.quoi === 'avancer' ? form.message : undefined} />
				<div><Bouton type="submit" desactive={envoi}>Enregistrer l’étape</Bouton></div>
			{:else if panneau === 'refuser'}
				<Champ id="texte-refuser" name="texte" lignes={2} requis maxlength={LIMITE_DEMANDE} libelle="Pourquoi ce refus ?" aide="L’agent le lira." erreur={form?.quoi === 'refuser' ? form.message : undefined} />
				<div><Bouton type="submit" variante="grave" desactive={envoi}>Refuser la demande</Bouton></div>
			{:else}
				<p>Le référent en sera prévenu s’il la suit déjà. Une demande annulée ne se rouvre pas.</p>
				<div><Bouton type="submit" variante="grave" desactive={envoi}>Oui, annuler ma demande</Bouton></div>
				{@render erreur('annuler')}
			{/if}
		</form>
	</Panneau>
{/if}

<style>
	.page,
	.colonnes,
	.contenu,
	.formulaire {
		display: flex;
		flex-direction: column;
		gap: var(--espace-16);
	}
	p {
		margin: 0;
	}
	.doux {
		color: var(--doux);
	}
	.doux:empty {
		display: none;
	}
	.bandeau {
		padding: var(--espace-12) var(--espace-16);
		border: 1px solid;
		border-radius: var(--rayon-petit);
	}
	.bandeau.ok {
		background: var(--statut-ok-fond);
		color: var(--statut-ok-texte);
		border-color: var(--statut-ok-trait);
	}
	.etapes,
	.fil {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: var(--espace-12);
	}
	.etapes li {
		display: flex;
		align-items: center;
		gap: var(--espace-12);
	}
	.puce {
		display: inline-grid;
		place-items: center;
		flex: none;
		width: 12px;
		height: 12px;
		margin-inline: var(--espace-4);
		border: 1px solid var(--trait);
		border-radius: 50%;
	}
	.faite .puce,
	.en-cours .puce {
		width: 20px;
		height: 20px;
		margin-inline: 0;
	}
	.faite .puce {
		border-color: var(--statut-ok-texte);
		background: var(--statut-ok-fond);
		color: var(--statut-ok-texte);
	}
	.en-cours {
		font-weight: 700;
	}
	.en-cours .puce {
		border-color: var(--rouge);
		border-width: 6px;
	}
	.a-venir {
		color: var(--doux);
	}
	.fil {
		gap: 0;
	}
	.fil li {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: var(--espace-12) 0;
	}
	.fil li:first-child {
		padding-top: 0;
	}
	.fil li + li {
		border-top: 1px solid var(--trait-doux);
	}
	.texte {
		white-space: pre-line;
		overflow-wrap: anywhere;
	}
	.question {
		padding: var(--espace-12) var(--espace-16);
		border: 1px solid var(--statut-alerte-trait);
		border-radius: var(--rayon-petit);
		background: var(--statut-alerte-fond);
		color: var(--statut-alerte-texte);
	}
	.question {
		display: flex;
		flex-direction: column;
		gap: var(--espace-8);
	}
	.gestes {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--espace-12);
	}
	.echec {
		color: var(--statut-danger-texte);
		font-weight: 600;
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
