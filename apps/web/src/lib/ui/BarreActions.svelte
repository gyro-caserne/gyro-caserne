<script module lang="ts">
	let actives = 0;
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';

	let { message, children }: { message?: string; children: Snippet } = $props();

	// Sa hauteur, pour que le navigateur ne cache jamais derrière elle le champ qui a le focus.
	// La variable n'est retirée qu'au départ de la dernière barre de la page.
	let hauteur = $state(0);
	$effect(() => {
		actives++;
		return () => {
			if (--actives === 0) document.documentElement.style.removeProperty('--hauteur-barre-actions');
		};
	});
	$effect(() => {
		document.documentElement.style.setProperty('--hauteur-barre-actions', `${hauteur}px`);
	});
</script>

<div class="barre-actions" bind:offsetHeight={hauteur}>
	<!-- La zone existe toujours, pour que le message qui s'y insère soit lu. -->
	<p class="message" role="status">{message ?? ''}</p>
	<div class="actions">{@render children()}</div>
</div>

<style>
	/* Un champ qui prend le focus, ou qu'on fait défiler, s'arrête au-dessus de la barre et de la navigation du bas. */
	:global(html:has(.barre-actions)) {
		scroll-padding-bottom: calc(var(--hauteur-barre-actions, 0px) + 3.5rem + env(safe-area-inset-bottom));
	}
	.barre-actions {
		position: sticky;
		/* Au téléphone, juste au-dessus de la navigation du bas. */
		bottom: calc(3.5rem + env(safe-area-inset-bottom));
		z-index: 5;
		margin: 0 -1rem;
		padding: var(--espace-12) var(--espace-16) var(--espace-16);
		background: var(--surface);
		border-top: 1px solid var(--trait-doux);
	}
	.message {
		margin: 0;
		font-size: var(--texte-14);
		color: var(--statut-alerte-texte);
	}
	.message:not(:empty) {
		margin-bottom: var(--espace-8);
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--espace-12);
	}
	@media (min-width: 1024px) {
		:global(html:has(.barre-actions)) {
			scroll-padding-bottom: var(--hauteur-barre-actions, 0px);
		}
		.barre-actions {
			bottom: 0;
			margin: 0;
			border: 1px solid var(--trait-doux);
			border-radius: var(--rayon-grand) var(--rayon-grand) 0 0;
		}
	}
</style>
