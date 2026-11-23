<script lang="ts">
	import { ETAPES_MAX, NOM_ETAPE_MAX, type ReglageDemandes } from '@gyro-caserne/socle';
	import Bouton from '#lib/ui/Bouton.svelte';
	import Champ from '#lib/ui/Champ.svelte';
	import Interrupteur from '#lib/ui/Interrupteur.svelte';

	// Le réglage des demandes d'un rôle : la case « Reçoit des demandes » (pour qui gère les rôles), puis ses étapes intermédiaires
	// et sa dernière étape. Chaque geste est un envoi : tout marche sans JavaScript.
	// Monter, descendre et retirer partent d'un formulaire à part : Entrée dans un nom enregistre les noms.
	let { reglage, peutCocher, action, form }: { reglage: ReglageDemandes | null; peutCocher: boolean; action: string; form: { cible?: string; succes?: string; message?: string } | null } = $props();
	const id = $props.id();
	const concerne = $derived(form?.cible === 'demandes');
</script>

<div class="reglage">
	<div role="alert">{#if concerne && form?.message}<p class="echec">{form.message}</p>{/if}</div>
	<div role="status">{#if concerne && form?.succes}<p class="succes">{form.succes}</p>{/if}</div>

	{#if peutCocher}
		<form method="POST" {action}>
			<input type="hidden" name="geste" value="basculer" />
			<Interrupteur libelle="Reçoit des demandes" description="Les agents lui écrivent depuis Caserne, puis Faire une demande, et le suivent jusqu’à la fin." nom="recoit" coche={reglage !== null} envoyer />
		</form>
	{/if}

	{#if reglage}
		<p class="aide">Une demande commence par Demandée, puis Prise en compte. Elle passe ensuite par ces étapes, dans l’ordre, et le référent peut en sauter. Elle finit sur la dernière étape, ou sur Refusée ou Annulée.</p>

		<form id="{id}-gestes" method="POST" {action}></form>
		<form method="POST" {action} class="champs">
			{#if reglage.etapes.length}
				<ol class="etapes">
					{#each reglage.etapes as e, i (e.id)}
						<li>
							<input type="hidden" name="etape-id" value={e.id} />
							<Champ id="{id}-etape-{e.id}" name="etape-nom" libelle="Étape {i + 1}" requis maxlength={NOM_ETAPE_MAX} valeur={e.nom} />
							<div class="gestes">
								{#if i > 0}<Bouton type="submit" variante="secondaire" form="{id}-gestes" name="geste" value="monter:{e.id}">Monter<span class="masque"> {e.nom}</span></Bouton>{/if}
								{#if i < reglage.etapes.length - 1}<Bouton type="submit" variante="secondaire" form="{id}-gestes" name="geste" value="descendre:{e.id}">Descendre<span class="masque"> {e.nom}</span></Bouton>{/if}
								<Bouton type="submit" variante="secondaire" form="{id}-gestes" name="geste" value="retirer:{e.id}">Retirer<span class="masque"> {e.nom}</span></Bouton>
							</div>
						</li>
					{/each}
				</ol>
			{:else}
				<p class="aide">Aucune étape intermédiaire.</p>
			{/if}
			<Champ id="{id}-derniere" name="derniere" libelle="Dernière étape" aide="Par exemple Livrée, ou Remise en main propre." requis maxlength={NOM_ETAPE_MAX} valeur={reglage.derniere} />
			<div><Bouton type="submit" name="geste" value="enregistrer">Enregistrer les étapes</Bouton></div>
		</form>

		{#if reglage.etapes.length < ETAPES_MAX}
			<form method="POST" {action} class="champs">
				<input type="hidden" name="geste" value="ajouter" />
				<Champ id="{id}-nouvelle" name="nouvelle" libelle="Nouvelle étape" aide="Par exemple Commandée. Elle se place avant la dernière étape." requis maxlength={NOM_ETAPE_MAX} />
				<div><Bouton type="submit" variante="secondaire">Ajouter l’étape</Bouton></div>
			</form>
		{/if}
	{/if}
</div>

<style>
	.reglage,
	.champs,
	.etapes {
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
	.echec,
	.succes {
		padding: var(--espace-12) var(--espace-16);
		border-radius: var(--rayon-petit);
		border: 2px solid var(--accent);
		font-weight: 600;
	}
	.succes {
		border-color: var(--ok);
	}
</style>
