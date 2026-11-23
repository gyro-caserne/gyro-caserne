<script lang="ts">
	import { NOM_ETAPE_MAX, ETAPES_MAX } from '@gyro-caserne/socle';
	import Bouton from '#lib/ui/Bouton.svelte';
	import Champ from '#lib/ui/Champ.svelte';
	import Interrupteur from '#lib/ui/Interrupteur.svelte';

	// Les champs du réglage des demandes d'un rôle, dans le formulaire de la page, qui les enregistre avec son propre bouton.
	// La case « Reçoit des demandes » seulement pour qui gère les rôles. Monter, descendre, retirer et ajouter envoient la saisie
	// à `apercu` : la page revient avec la saisie changée, rien n'est enregistré ni perdu. Tout marche sans JavaScript.
	type Saisie = { recoit: boolean; etapes: { id?: string; nom: string }[]; derniere: string };
	let { saisie, peutCocher, apercu }: { saisie: Saisie; peutCocher: boolean; apercu: string } = $props();
	const id = $props.id();
</script>

<div class="reglage">
	<input type="hidden" name="demandes" value="1" />
	{#if peutCocher}
		<input type="hidden" name="case-demandes" value="1" />
		<Interrupteur libelle="Reçoit des demandes" description="Les agents lui écrivent depuis Caserne, puis Faire une demande, et le suivent jusqu’à la fin." nom="recoit" coche={saisie.recoit} />
	{/if}

	<p class="aide">Une demande commence par Demandée, puis Prise en compte. Elle passe ensuite par ces étapes, dans l’ordre, et le référent peut en sauter. Elle finit sur la dernière étape, ou sur Refusée ou Annulée.</p>

	{#if saisie.etapes.length}
		<ol class="etapes">
			{#each saisie.etapes as e, i (i)}
				<li>
					<input type="hidden" name="etape-id" value={e.id ?? ''} />
					<Champ id="{id}-etape-{i}" name="etape-nom" libelle="Étape {i + 1}" requis maxlength={NOM_ETAPE_MAX} valeur={e.nom} />
					<div class="gestes">
						{#if i > 0}<Bouton type="submit" variante="secondaire" formaction={apercu} name="geste" value="monter:{i}">Monter<span class="masque"> {e.nom}</span></Bouton>{/if}
						{#if i < saisie.etapes.length - 1}<Bouton type="submit" variante="secondaire" formaction={apercu} name="geste" value="descendre:{i}">Descendre<span class="masque"> {e.nom}</span></Bouton>{/if}
						<Bouton type="submit" variante="secondaire" formaction={apercu} name="geste" value="retirer:{i}">Retirer<span class="masque"> {e.nom}</span></Bouton>
					</div>
				</li>
			{/each}
		</ol>
	{:else}
		<p class="aide">Aucune étape intermédiaire.</p>
	{/if}

	{#if saisie.etapes.length < ETAPES_MAX}
		<div class="ajout">
			<Champ id="{id}-nouvelle" name="nouvelle" libelle="Nouvelle étape" aide="Par exemple Commandée. Elle se place avant la dernière étape." maxlength={NOM_ETAPE_MAX} />
			<div><Bouton type="submit" variante="secondaire" formaction={apercu} name="geste" value="ajouter">Ajouter l’étape</Bouton></div>
		</div>
	{/if}

	<Champ id="{id}-derniere" name="derniere" libelle="Dernière étape" aide="Par exemple Livrée, ou Remise en main propre." requis maxlength={NOM_ETAPE_MAX} valeur={saisie.derniere} />
</div>

<style>
	.reglage,
	.etapes,
	.ajout {
		display: flex;
		flex-direction: column;
		gap: var(--espace-16);
	}
	.reglage {
		padding-bottom: var(--espace-16);
	}
	p {
		margin: 0;
	}
	.aide {
		color: var(--doux);
	}
	.etapes {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.etapes li {
		display: flex;
		flex-direction: column;
		gap: var(--espace-8);
	}
	.etapes li + li {
		padding-top: var(--espace-16);
		border-top: 1px solid var(--trait-doux);
	}
	.gestes {
		display: flex;
		flex-wrap: wrap;
		gap: var(--espace-8);
	}
</style>
