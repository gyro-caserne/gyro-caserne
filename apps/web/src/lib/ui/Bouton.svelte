<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		type = 'button',
		variante = 'principal',
		desactive = false,
		onclick,
		name,
		value,
		formaction,
		etendu,
		controle,
		children
	}: {
		type?: 'button' | 'submit';
		variante?: 'principal' | 'secondaire' | 'grave';
		desactive?: boolean;
		onclick?: () => void;
		name?: string;
		value?: string;
		formaction?: string;
		etendu?: boolean;
		controle?: string;
		children: Snippet;
	} = $props();
</script>

<!-- `name` et `value` : le bouton d'envoi appuyé dit son geste au serveur, sans JavaScript ; `formaction` : il l'envoie à une autre action.
     `etendu` et `controle` : un bouton qui déplie une zone de la page (aria-expanded, aria-controls). -->
<button
	{type}
	class={variante}
	disabled={desactive}
	{onclick}
	{name}
	{value}
	{formaction}
	formnovalidate={formaction ? true : undefined}
	aria-expanded={etendu === undefined ? undefined : etendu ? 'true' : 'false'}
	aria-controls={controle}>{@render children()}</button>

<style>
	button {
		min-height: var(--cible);
		padding: 0 var(--espace-20);
		border-radius: var(--rayon-bouton);
		font: 700 var(--texte-16) var(--police);
		cursor: pointer;
	}
	/* Un à-plat, sans contour : le bord transparent reste pour le mode contrasté. */
	.principal {
		background: var(--rouge);
		color: var(--sur-rouge);
		border: 1px solid transparent;
	}
	button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
	/* Une action difficile à défaire : un contour et un texte d'alerte, et un libellé sans ambiguïté. */
	.grave {
		background: var(--surface);
		color: var(--accent);
		border: 1px solid var(--accent);
		font-weight: 600;
	}
	.secondaire {
		background: var(--surface);
		color: var(--encre);
		border: 1px solid var(--trait);
		font-weight: 600;
	}
</style>
