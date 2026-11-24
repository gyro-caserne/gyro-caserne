<script lang="ts">
	import type { Echelon } from '@gyro-caserne/socle';

	// L'insigne d'ancienneté : une médaille et son ruban, à l'encre. Le disque prend la couleur de l'échelon atteint
	// (bronze, argent, vermeil, or, grand or) ; avant le premier, la médaille reste à l'encre seule.
	// Toujours décoratif : l'échelon est écrit à côté, la couleur n'est jamais la seule information.
	let { echelon, taille = 24 }: { echelon: Echelon | null; taille?: number } = $props();
</script>

<svg class="insigne {echelon ?? 'neutre'}" viewBox="0 0 24 24" width={taille} height={taille} aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
	<path d="M8 2.5h8l-2.6 7h-2.8z" />
	<circle class="disque" cx="12" cy="15.5" r="6" />
	{#if echelon === 'grand_or'}<circle cx="12" cy="15.5" r="4.4" />{/if}
	<path class="etoile" d="M12 12.6l.73 1.89 2.03.11-1.57 1.29.51 1.96L12 16.75l-1.7 1.1.51-1.96-1.57-1.29 2.03-.11z" />
</svg>

<style>
	.insigne {
		flex: none;
		display: inline-block;
		color: var(--encre);
	}
	.bronze .disque {
		fill: var(--medaille-bronze);
	}
	.argent .disque {
		fill: var(--medaille-argent);
	}
	.vermeil .disque {
		fill: var(--medaille-vermeil);
	}
	.or .disque {
		fill: var(--medaille-or);
	}
	.grand_or .disque {
		fill: var(--medaille-grand-or);
	}
	/* Sur un disque coloré, l'étoile se lit en clair. */
	.insigne:not(.neutre) .etoile {
		fill: var(--surface);
	}
</style>
