<script lang="ts">
	import { untrack } from 'svelte';
	import Bouton from '#lib/ui/Bouton.svelte';
	import Carte from '#lib/ui/Carte.svelte';
	import Champ from '#lib/ui/Champ.svelte';
	import Choix from '#lib/ui/Choix.svelte';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';
	import { LIBELLES_STATUT } from '#lib/ui/statut.ts';

	let { data, form } = $props();

	const valeurs = $derived(form?.valeurs ?? {});
	const erreurs = $derived(form?.erreurs ?? {});

	// Le profil choisi : une personne extérieure (retraité, réserve citoyenne) n'a ni grade, ni statut, ni dates de parcours, ni équipe.
	// Sans JavaScript, tout reste affiché et le serveur ignore ces champs.
	const profilDeDepart = () => valeurs.profilId ?? data.profilParDefaut;
	let profilChoisi = $state(untrack(profilDeDepart));
	$effect.pre(() => {
		profilChoisi = profilDeDepart();
	});
	const exterieur = $derived(data.profils.some((p) => String(p.id) === profilChoisi && p.typePersonne === 'exterieur'));
</script>

<svelte:head>
	<title>Ajouter un agent</title>
</svelte:head>

<div class="nouveau">
	<EnTetePage titre="Ajouter un agent" phrase="Sa fiche pourra être complétée ensuite." />
	<div role="alert">
		{#if form?.message || form?.erreurs}<p class="echec">{form.message ?? 'Le formulaire contient des erreurs.'}</p>{/if}
	</div>

	<form method="POST">
		<Carte titre="Identité et contact">
			<div class="champs">
				<Champ id="prenom" name="prenom" libelle="Prénom" requis maxlength={60} valeur={valeurs.prenom ?? ''} erreur={erreurs.prenom} />
				<Champ id="nom" name="nom" libelle="Nom" requis maxlength={60} valeur={valeurs.nom ?? ''} erreur={erreurs.nom} />
				<Champ id="email" name="email" type="email" libelle="E-mail" aide="Sert à la connexion." requis maxlength={254} valeur={valeurs.email ?? ''} erreur={erreurs.email} />
				<Champ id="telephone" name="telephone" type="tel" libelle="Téléphone" maxlength={20} valeur={valeurs.telephone ?? ''} erreur={erreurs.telephone} />
				<Champ id="naissance" name="naissance" type="date" libelle="Date de naissance" valeur={valeurs.naissance ?? ''} erreur={erreurs.naissance} />
			</div>
		</Carte>

		<Carte titre={exterieur ? 'Profil' : 'Parcours'}>
			<div class="champs">
				<Choix
					id="profil"
					name="profilId"
					libelle="Profil"
					requis
					aide={exterieur ? 'Personne extérieure, hors du planning et des équipes.' : undefined}
					bind:valeur={profilChoisi}
					erreur={erreurs.profilId}
					options={data.profils.map((p) => ({ valeur: String(p.id), libelle: p.nom }))}
				/>
				{#if !exterieur}
					<Choix
						id="grade"
						name="gradeId"
						libelle="Grade"
						valeur={valeurs.gradeId ?? ''}
						erreur={erreurs.gradeId}
						options={[{ valeur: '', libelle: 'Aucun grade' }, ...data.grades.map((g) => ({ valeur: String(g.id), libelle: g.libelle }))]}
					/>
					<Champ id="date-grade" name="dateGrade" type="date" libelle="Date de nomination" valeur={valeurs.dateGrade ?? ''} erreur={erreurs.dateGrade} />
					<Choix
						id="statut"
						name="statut"
						libelle="Statut"
						valeur={valeurs.statut ?? 'operationnel'}
						erreur={erreurs.statut}
						options={data.statuts.map((s) => ({ valeur: s, libelle: LIBELLES_STATUT[s] }))}
					/>
					<Champ id="entree-centre" name="entreeCentre" type="date" libelle="Entrée au centre" valeur={valeurs.entreeCentre ?? ''} erreur={erreurs.entreeCentre} />
					<Champ id="engagement-spv" name="engagementSpv" type="date" libelle="Engagement SPV" valeur={valeurs.engagementSpv ?? ''} erreur={erreurs.engagementSpv} />
				{/if}
			</div>
		</Carte>

		{#if !exterieur}
			<Carte titre="Équipe">
				<Choix
					id="equipe"
					name="equipeId"
					libelle="Équipe"
					aide="À partir d'aujourd'hui."
					valeur={valeurs.equipeId ?? ''}
					erreur={erreurs.equipeId}
					options={[{ valeur: '', libelle: 'Aucune équipe' }, ...data.equipes.map((e) => ({ valeur: String(e.id), libelle: e.nom }))]}
				/>
			</Carte>
		{/if}

		<Bouton type="submit">{exterieur ? 'Ajouter la personne' : "Ajouter l'agent"}</Bouton>
	</form>
</div>

<style>
	.nouveau,
	form,
	.champs {
		display: flex;
		flex-direction: column;
		gap: var(--espace-16);
	}
	form > :global(button) {
		align-self: flex-start;
	}
	p {
		margin: 0;
	}
	.echec {
		padding: var(--espace-12) var(--espace-16);
		border-radius: var(--rayon-petit);
		border: 2px solid var(--accent);
		font-weight: 600;
	}
</style>
