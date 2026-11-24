<script lang="ts">
	import Choix from '#lib/ui/Choix.svelte';
	import { tick } from 'svelte';
	import { enhance, type SubmitFunction } from '$app/forms';
	import type { Fiche } from '@gyro-caserne/socle';
	import { goto } from '$app/navigation';
	import { compteFiche, dateCourte, enListe, nomsPrevenus } from '#lib/engins/textes.ts';
	import Panneau from '#lib/planning/Panneau.svelte';
	import { pluriel } from '#lib/pluriel.ts';
	import Bouton from '#lib/ui/Bouton.svelte';
	import Champ from '#lib/ui/Champ.svelte';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';
	import Groupe from '#lib/ui/Groupe.svelte';

	type Reponse = { cible?: string; zone?: number | 'derniere' | null; succes?: string; message?: string; valeurs?: { nom: string; libelle: string; quantite: string } } | null;
	type Role = { id: number; nom: string };
	let { data, form }: { data: { fiche: Fiche; roles: Role[]; prevenir: number | null; retirerZone: number | null; nouveau: boolean }; form: Reponse } = $props();

	const f = $derived(data.fiche);
	// Qui est prévenu d'une anomalie de la zone : les rôles choisis, sinon ceux qui traitent les anomalies.
	const prevenus = (z: Fiche['zones'][number]) => enListe(nomsPrevenus(z.prevenir, data.roles));
	const resumeZone = (z: Fiche['zones'][number]) => pluriel(z.elements.length, 'élément') + (prevenus(z) ? `, prévient ${prevenus(z)}` : '');
	const zonePrevenir = $derived(f.zones.find((z) => z.ref === data.prevenir) ?? null);
	// Le volet se ferme une fois enregistré ; le message de réussite est gardé, la navigation qui le ferme effaçant `form`.
	let reussite = $state('');
	// La zone du volet reste ouverte quand il se ferme (enregistré, Échap, Fermer) : le focus revient à sa ligne Prévenir.
	let zoneDuVolet = $state<number | null>(null);
	const fermerVolet: SubmitFunction = ({ formData }) => {
		const zone = Number(formData.get('zone'));
		zoneDuVolet = zone;
		reussite = '';
		return async ({ update, result }) => {
			await update({ reset: false });
			if (result.type === 'success') {
				await goto('?', { replaceState: true });
				reussite = String(result.data?.succes ?? '');
				document.getElementById(`prevenir-${zone}`)?.focus();
			}
		};
	};
	const pour = (cible: string) => (form?.cible === cible ? form : null);
	// La zone touchée reste ouverte ; une nouvelle zone s'ouvre.
	const ouverte = (ref: number, i: number) => form?.zone === ref || (form?.zone === 'derniere' && i === f.zones.length - 1) || data.retirerZone === ref;
	// Après un geste, le focus reste sur le même bouton (ligne déplacée) ; s'il n'existe plus ou est grisé, sur la zone.
	const garderFocus: SubmitFunction = ({ submitter, formData }) => {
		const geste = submitter?.getAttribute('data-geste');
		const zone = formData.get('zone');
		return async ({ update }) => {
			await update();
			await tick();
			const bouton = geste ? document.querySelector<HTMLButtonElement>(`[data-geste="${geste}"]`) : null;
			if (bouton && !bouton.disabled) bouton.focus();
			else document.getElementById(`zone-${zone}`)?.focus();
		};
	};
	// Arrivé pour retirer une zone : le focus va à la question.
	$effect(() => {
		if (data.retirerZone) document.getElementById(`confirmer-${data.retirerZone}`)?.focus();
	});
	const HAUT = 'M12 19V5M5 12l7-7 7 7';
	const BAS = 'M12 5v14M5 12l7 7 7-7';
</script>

<svelte:head>
	<title>Fiche {f.type}</title>
</svelte:head>

{#snippet fleche(trace: string)}
	<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d={trace} /></svg>
{/snippet}

{#snippet message(cible: string)}
	{#if pour(cible)?.message}<p class="echec" role="alert">{pour(cible)?.message}</p>{/if}
{/snippet}

<div class="page">
	<EnTetePage titre="Fiche {f.type}" phrase="Les modifications valent pour la prochaine prise." retour={{ href: '/engins/fiches', libelle: 'Fiches' }} />

	<p class="version">
		<strong>Version {f.version.numero}</strong>, du {dateCourte(f.version.creeLe)} ({f.version.auteur}). {compteFiche(f.zones)}.
		{#if f.version.utilisee}Elle a déjà servi à une prise. La modifier crée la version {f.version.numero + 1}, l’historique garde celle-ci.{/if}
	</p>

	<div role="status" class="masque">{form ? (form.succes ?? '') : reussite}</div>
	{#if form ? form.succes : reussite}<p class="succes">{form ? form.succes : reussite}</p>{/if}
	{#if data.nouveau && f.zones.length === 0}<p class="note">Fiche créée. Commencez par ses zones : cabine, coffres, sacs…</p>{/if}

	<div class="zones pile">
		{#each f.zones as z, i (z.ref)}
			<Groupe titre={z.nom} resume={resumeZone(z)} ouvert={ouverte(z.ref, i) || (form?.cible === 'prevenir' && form.zone === z.ref) || data.prevenir === z.ref || zoneDuVolet === z.ref}>
				<div class="zone" id="zone-{z.ref}" tabindex="-1" role="group" aria-label="Zone {z.nom}">
					<a class="prevenir" id="prevenir-{z.ref}" href="?prevenir={z.ref}" data-sveltekit-reset="false" data-sveltekit-noscroll onclick={() => (zoneDuVolet = z.ref)}>
						<span class="texte"><span class="titre">Prévenir<span class="masque">{' '}pour la zone {z.nom}</span></span><span class="qui">{prevenus(z) || 'Ceux qui traitent les anomalies'}</span></span>
						<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6" /></svg>
					</a>
					{#if z.elements.length === 0}<p class="doux">Aucun élément. Ajoutez le premier ci-dessous.</p>{/if}
					<ol role="list">
						{#each z.elements as e, j (e.ref)}
							<li>
								<div class="element">
									<span class="libelle">{e.libelle}</span>
									{#if e.quantite !== null}<span class="quantite">{e.quantite}<span class="masque">{' '}attendus</span></span>{/if}
									<details class="geste" open={pour(`element:${e.ref}`)?.message !== undefined}>
										<summary>Modifier<span class="masque">{' '}{e.libelle}</span></summary>
									<form method="POST" action="?/geste" use:enhance={garderFocus} class="gestes">
										<input type="hidden" name="element" value={e.ref} />
										<input type="hidden" name="zone" value={z.ref} />
										<input type="hidden" name="cible" value="element:{e.ref}" />
										<button type="submit" class="rond" name="quoi" value="monter_element" data-geste="monter:{e.ref}" disabled={j === 0}>{@render fleche(HAUT)}<span class="masque">Monter {e.libelle}</span></button>
										<button type="submit" class="rond" name="quoi" value="descendre_element" data-geste="descendre:{e.ref}" disabled={j === z.elements.length - 1}>{@render fleche(BAS)}<span class="masque">Descendre {e.libelle}</span></button>
										<button type="submit" class="petit" name="quoi" value="retirer_element" data-geste="retirer:{e.ref}">Retirer<span class="masque">{' '}{e.libelle}</span></button>
									</form>
										<form method="POST" action="?/geste" use:enhance class="formulaire">
											<input type="hidden" name="quoi" value="modifier_element" />
											<input type="hidden" name="element" value={e.ref} />
											<input type="hidden" name="cible" value="element:{e.ref}" />
											<Champ id="libelle-{e.ref}" name="libelle" libelle="Élément" requis maxlength={120} valeur={e.libelle} />
											<Champ id="quantite-{e.ref}" name="quantite" type="number" libelle="Quantité attendue" aide="Laissez vide pour un élément seulement présent ou manquant." valeur={e.quantite === null ? '' : String(e.quantite)} />
											<Choix id="zone-{e.ref}" name="zone" libelle="Zone" valeur={String(z.ref)} options={f.zones.map((autre) => ({ valeur: String(autre.ref), libelle: autre.nom }))} />
											<div><Bouton type="submit">Enregistrer<span class="masque">{' '}{e.libelle}</span></Bouton></div>
										</form>
									</details>
								</div>
								{@render message(`element:${e.ref}`)}
							</li>
						{/each}
					</ol>

					<details class="plus" open={pour(`ajout:${z.ref}`) !== null}>
						<summary>Ajouter un élément<span class="masque">{' '}à {z.nom}</span></summary>
					<form method="POST" action="?/geste" use:enhance class="formulaire ajout">
						<input type="hidden" name="quoi" value="ajouter_element" />
						<input type="hidden" name="zone" value={z.ref} />
						<input type="hidden" name="cible" value="ajout:{z.ref}" />
						<Champ id="ajout-{z.ref}" name="libelle" libelle="Ajouter un élément à « {z.nom} »" requis maxlength={120} valeur={pour(`ajout:${z.ref}`)?.valeurs?.libelle ?? ''} />
						<Champ id="ajout-quantite-{z.ref}" name="quantite" type="number" libelle="Quantité attendue (facultative)" valeur={pour(`ajout:${z.ref}`)?.valeurs?.quantite ?? ''} />
						<div><Bouton type="submit" variante="secondaire">Ajouter l’élément</Bouton></div>
					</form>
					</details>
					{@render message(`ajout:${z.ref}`)}

					<details class="plus" open={pour(`zone:${z.ref}`)?.message !== undefined || data.retirerZone === z.ref}>
						<summary>Gérer la zone<span class="masque">{' '}{z.nom}</span></summary>
					<div class="outils">
						<form method="POST" action="?/geste" use:enhance={garderFocus} class="gestes">
							<input type="hidden" name="zone" value={z.ref} />
							<input type="hidden" name="cible" value="zone:{z.ref}" />
							<button type="submit" class="petit" name="quoi" value="monter_zone" data-geste="monter-zone:{z.ref}" disabled={i === 0}>{@render fleche(HAUT)} Monter<span class="masque">{' '}la zone {z.nom}</span></button>
							<button type="submit" class="petit" name="quoi" value="descendre_zone" data-geste="descendre-zone:{z.ref}" disabled={i === f.zones.length - 1}>{@render fleche(BAS)} Descendre<span class="masque">{' '}la zone {z.nom}</span></button>
						</form>
						<details class="repli" open={pour(`zone:${z.ref}`)?.message !== undefined}>
							<summary>Renommer<span class="masque">{' '}la zone {z.nom}</span></summary>
							<form method="POST" action="?/geste" use:enhance class="formulaire">
								<input type="hidden" name="quoi" value="renommer_zone" />
								<input type="hidden" name="zone" value={z.ref} />
								<input type="hidden" name="cible" value="zone:{z.ref}" />
								<Champ id="nom-zone-{z.ref}" name="nom" libelle="Nom de la zone" requis maxlength={40} valeur={z.nom} />
								<div><Bouton type="submit">Renommer</Bouton></div>
							</form>
						</details>
						{#if data.retirerZone === z.ref}
							<form method="POST" action="?/geste" use:enhance class="confirmer" id="confirmer-{z.ref}" tabindex="-1" aria-label="Retirer la zone {z.nom}">
								<input type="hidden" name="zone" value={z.ref} />
								<p><strong>Retirer « {z.nom} »{z.elements.length ? ` et ses ${pluriel(z.elements.length, 'élément')}` : ''} ?</strong> Les prises passées les gardent.</p>
								<div class="gestes">
									<Bouton type="submit" variante="grave">Oui, retirer<span class="masque">{' '}la zone {z.nom}</span></Bouton>
									<a class="petit" href="?">Annuler</a>
								</div>
								<input type="hidden" name="quoi" value="retirer_zone" />
							</form>
						{:else}
							<a class="petit retirer" href="?retirer-zone={z.ref}">Retirer la zone<span class="masque">{' '}{z.nom}</span></a>
						{/if}
						{@render message(`zone:${z.ref}`)}
					</div>
					</details>
				</div>
			</Groupe>
		{/each}
	</div>

	{#if zonePrevenir}
		<Panneau titre="Prévenir pour {zonePrevenir.nom}" fermer="?">
			<form method="POST" action="?/prevenir&prevenir={zonePrevenir.ref}" use:enhance={fermerVolet} class="formulaire">
				<input type="hidden" name="zone" value={zonePrevenir.ref} />
				<p class="doux">Une anomalie signalée dans cette zone prévient les titulaires des rôles cochés et le chef de garde. Sans rôle coché, ceux qui traitent les anomalies sont prévenus.</p>
				<fieldset class="roles">
					<legend class="masque">Rôles prévenus</legend>
					{#each data.roles as r (r.id)}
						<label class="case"><input type="checkbox" name="role" value={r.id} checked={zonePrevenir.prevenir.includes(r.id)} /> {r.nom}</label>
					{/each}
				</fieldset>
				{#if form?.cible === 'prevenir' && form.message}<p class="echec" role="alert">{form.message}</p>{/if}
				<div><Bouton type="submit">Enregistrer</Bouton></div>
			</form>
		</Panneau>
	{/if}

	<section class="panneau" aria-labelledby="titre-nouvelle-zone">
		<h2 id="titre-nouvelle-zone">Ajouter une zone</h2>
		<form method="POST" action="?/geste" use:enhance class="formulaire">
			<input type="hidden" name="quoi" value="ajouter_zone" />
			<input type="hidden" name="cible" value="nouvelle-zone" />
			<Champ id="nouvelle-zone" name="nom" libelle="Nom de la zone" aide="Une partie de l’engin ou un sac : « Cabine », « Coffre arrière gauche », « Sac ARI »." requis maxlength={40} valeur={pour('nouvelle-zone')?.valeurs?.nom ?? ''} erreur={pour('nouvelle-zone')?.message} />
			<div><Bouton type="submit">Ajouter la zone</Bouton></div>
		</form>
	</section>
</div>

<style>
	.page,
	.zones,
	.zone {
		display: flex;
		flex-direction: column;
		gap: var(--espace-16);
	}
	.zone {
		padding: var(--espace-4) var(--espace-16) var(--espace-16);
	}
	.zone:focus-visible,
	.confirmer:focus-visible {
		outline: 3px solid var(--encre);
		outline-offset: 2px;
	}
	p,
	h2,
	ol {
		margin: 0;
	}
	h2 {
		font: 700 var(--texte-20) var(--police-titre);
	}
	.doux,
	.version {
		color: var(--doux);
	}
	.version strong {
		color: var(--encre);
	}
	ol {
		padding: 0;
		list-style: none;
	}
	li {
		display: flex;
		flex-direction: column;
		gap: var(--espace-6);
		padding: var(--espace-12) 0;
	}
	li + li {
		border-top: 1px solid var(--trait-doux);
	}
	.element {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--espace-8) var(--espace-12);
	}
	.libelle {
		flex: 1 1 60%;
		font-weight: 600;
		overflow-wrap: anywhere;
	}
	.quantite {
		flex: none;
		min-width: 2.5em;
		padding: 0 var(--espace-8);
		border: 1px solid var(--trait);
		border-radius: 999px;
		text-align: center;
		font-weight: 700;
	}
	.gestes {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--espace-8);
	}
	.rond,
	.petit {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--espace-6);
		min-height: var(--cible);
		border: 1px solid var(--trait);
		border-radius: var(--rayon-bouton);
		background: var(--surface);
		color: var(--encre);
		font: 600 var(--texte-15) var(--police);
		text-decoration: none;
		cursor: pointer;
	}
	.rond {
		width: var(--cible);
		padding: 0;
	}
	.petit {
		padding: 0 var(--espace-16);
	}
	.rond:disabled,
	.petit:disabled {
		opacity: 0.45;
		cursor: default;
	}
	.retirer {
		align-self: flex-start;
	}
	.prevenir {
		display: flex;
		align-items: center;
		gap: var(--espace-12);
		min-height: var(--cible);
		padding: var(--espace-8) 0 var(--espace-12);
		border-bottom: 1px solid var(--trait-doux);
		color: var(--encre);
		text-decoration: none;
	}
	.prevenir .texte {
		display: flex;
		flex: 1;
		flex-direction: column;
	}
	.prevenir .titre {
		font-weight: 600;
	}
	.prevenir .qui {
		color: var(--doux);
	}
	.prevenir svg {
		flex: none;
		color: var(--doux);
	}
	.roles label {
		display: flex;
		align-items: center;
		gap: var(--espace-12);
		min-height: var(--cible);
	}
	.roles {
		display: flex;
		flex-direction: column;
		margin: 0;
		padding: 0;
		border: 0;
	}
	summary {
		display: inline-flex;
		align-items: center;
		min-height: var(--cible);
		padding: 0 var(--espace-16);
		border: 1px solid var(--trait);
		border-radius: var(--rayon-bouton);
		font-weight: 600;
		cursor: pointer;
		list-style: none;
	}
	/* Ouvert, le formulaire prend toute la largeur sous l'élément. */
	.element details[open] {
		flex-basis: 100%;
	}
	.outils details {
		align-self: flex-start;
	}
	.outils details[open] {
		align-self: stretch;
	}
	.formulaire {
		display: flex;
		flex-direction: column;
		gap: var(--espace-12);
		padding: var(--espace-12) 0 var(--espace-4);
	}
	.ajout {
		padding: var(--espace-16);
		border: 1px dashed var(--trait);
		border-radius: var(--rayon-petit);
	}
	.outils {
		display: flex;
		flex-direction: column;
		gap: var(--espace-12);
		padding-top: var(--espace-12);
		border-top: 1px solid var(--trait-doux);
	}
	.confirmer {
		display: flex;
		flex-direction: column;
		gap: var(--espace-12);
		padding: var(--espace-12) var(--espace-16);
		border: 2px solid var(--accent);
		border-radius: var(--rayon-petit);
	}
	.panneau {
		display: flex;
		flex-direction: column;
		gap: var(--espace-8);
		padding: var(--espace-16);
		background: var(--surface);
		border: 1px solid transparent;
		box-shadow: var(--ombre-carte);
		border-radius: var(--rayon-grand);
	}
	.succes,
	.note {
		padding: var(--espace-12) var(--espace-16);
		border-radius: var(--rayon-petit);
		font-weight: 600;
	}
	.succes {
		background: var(--statut-ok-fond);
		color: var(--statut-ok-texte);
		border: 1px solid var(--statut-ok-trait);
	}
	.note {
		border: 1px solid var(--trait);
	}
	.echec {
		padding: var(--espace-12) var(--espace-16);
		border-radius: var(--rayon-petit);
		border: 2px solid var(--accent);
		font-weight: 600;
	}
	.masque {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}
	@media (min-width: 1024px) {
		.page {
			max-width: var(--largeur-liste);
			margin-inline: auto;
		}
	}
</style>
