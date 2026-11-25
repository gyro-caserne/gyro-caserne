<script lang="ts">
	import { onMount, tick, untrack } from 'svelte';
	import Bouton from '#lib/ui/Bouton.svelte';
	import IconeRole from '#lib/ui/IconeRole.svelte';
	import { ICONES_ROLES, type IconeRole as Icone } from '#lib/ui/icones-roles.ts';
	import { NOMS_ICONES } from './roles.ts';

	// L'icône d'un rôle ou d'un comité, choisie dans la petite liste fixe. On voit celle choisie ; « Changer d'icône » déplie la grille
	// sur place, et un choix la referme. Sans JavaScript, la grille est dans un repli simple.
	let { valeur, erreur, legende = 'Icône', sansChoix = 'Aucune' }: { valeur?: Icone; erreur?: string; legende?: string; sansChoix?: string } = $props();
	const id = $props.id();

	let choisie = $state(untrack(() => valeur ?? ''));
	// Une autre valeur venue de la page (un autre rôle, même écran) remplace le choix.
	$effect.pre(() => {
		choisie = valeur ?? '';
	});
	let ouverte = $state(untrack(() => Boolean(erreur)));
	let monte = $state(false);
	let racine: HTMLFieldSetElement;
	onMount(() => (monte = true));

	// Au doigt ou à la souris, un choix referme la grille. Au clavier, les flèches parcourent les icônes, Entrée ou Espace choisit et referme.
	async function refermer() {
		ouverte = false;
		await tick();
		racine.querySelector<HTMLButtonElement>('.changer button')?.focus();
	}
	const auClic = (e: MouseEvent) => {
		if (e.detail > 0) refermer();
	};
	// Entrée enverrait le formulaire : elle choisit seulement.
	const auClavier = (e: KeyboardEvent & { currentTarget: HTMLInputElement }) => {
		if (e.key !== 'Enter') return;
		e.preventDefault();
		choisie = e.currentTarget.value;
		refermer();
	};
	// Espace coche la case à l'appui : on referme au relâché, pour ne pas lui voler le focus avant.
	const auRelache = (e: KeyboardEvent & { currentTarget: HTMLInputElement }) => {
		if (e.key !== ' ') return;
		choisie = e.currentTarget.value;
		refermer();
	};
</script>

{#snippet grille()}
	<div class="tuiles">
		{#each Object.keys(ICONES_ROLES) as Icone[] as icone (icone)}
			<label class="tuile">
				<input type="radio" name="icone" value={icone} bind:group={choisie} onclick={auClic} onkeydown={auClavier} onkeyup={auRelache} />
				<IconeRole {icone} taille={40} />
				<span class="cache">{NOMS_ICONES[icone]}</span>
			</label>
		{/each}
	</div>
{/snippet}

<fieldset class="icones" bind:this={racine} aria-describedby={erreur ? `${id}-erreur` : undefined}>
	<legend>{legende}</legend>
	{#if erreur}<p class="erreur" id="{id}-erreur">{erreur}</p>{/if}
	<div class="ligne">
		<div class="choisie">
			{#if choisie}<IconeRole icone={choisie as Icone} taille={40} />{/if}
			<span aria-live="polite">{choisie ? NOMS_ICONES[choisie as Icone] : sansChoix}</span>
		</div>
		{#if monte}<div class="changer"><Bouton variante="secondaire" etendu={ouverte} controle="{id}-grille" onclick={() => (ouverte = !ouverte)}>Changer d’icône</Bouton></div>{/if}
	</div>
	{#if monte}
		<div id="{id}-grille" class="grille" hidden={!ouverte}>{@render grille()}</div>
	{:else}
		<details class="repli" {...erreur ? { open: true } : {}}><summary>Changer d’icône</summary>{@render grille()}</details>
	{/if}
</fieldset>

<style>
	.icones {
		border: none;
		margin: 0;
		padding: 0;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: var(--espace-8);
	}
	legend {
		font-weight: 600;
		padding: 0;
		margin-bottom: var(--espace-8);
	}
	.ligne {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--espace-12);
	}
	.choisie {
		display: flex;
		align-items: center;
		gap: var(--espace-12);
		min-height: var(--cible);
	}
	.grille,
	details > .tuiles {
		padding-top: var(--espace-4);
	}
	.tuiles {
		display: flex;
		flex-wrap: wrap;
		gap: var(--espace-6);
	}
	.tuile {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 52px;
		height: 52px;
		border: 2px solid transparent;
		border-radius: var(--rayon-grand);
		cursor: pointer;
	}
	.tuile input {
		position: absolute;
		opacity: 0;
		inset: 0;
		margin: 0;
		cursor: pointer;
	}
	/* L'icône choisie : cadre épais et coche, pas seulement une couleur. */
	.tuile:has(input:checked) {
		border-color: var(--encre);
	}
	.tuile:has(input:checked)::after {
		content: '✓' / '';
		position: absolute;
		top: -6px;
		right: -6px;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: var(--encre);
		color: var(--surface);
		font-size: var(--texte-12);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.tuile:has(input:focus-visible) {
		outline: 3px solid var(--focus);
		outline-offset: 2px;
	}
	.cache {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}
	.erreur {
		margin: 0;
		color: var(--accent);
		font-weight: 600;
	}
</style>
