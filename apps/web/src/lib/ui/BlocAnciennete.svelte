<script lang="ts">
	import type { Anciennete } from '@gyro-caserne/socle';
	import { textesAnciennete } from '#lib/anciennete.ts';
	import InsigneAnciennete from './InsigneAnciennete.svelte';

	// L'ancienneté de service d'un agent (fiche, Moi) : l'insigne de l'échelon atteint, les années en grand, l'échelon écrit,
	// et une fine barre vers le prochain palier. `completer` : qui peut modifier la fiche lit « Date d'engagement à compléter ».
	let { a, completer = false }: { a: Anciennete; completer?: boolean } = $props();

	const t = $derived(textesAnciennete(a));
</script>

{#if t || completer}
	<section class="anciennete" aria-labelledby="t-anciennete">
		<h2 id="t-anciennete" class="masque">Ancienneté</h2>
		<div class="haut">
			<InsigneAnciennete echelon={a.echelon} taille={56} />
			<div class="texte">
				{#if t}
					<p class="nombre">{t.nombre}</p>
					<p class="sous">{t.sous}</p>
					{#if t.echelon}<p class="echelon">{t.echelon}</p>{/if}
				{/if}
				{#if a.annees === null && completer}<p class="completer">Date d’engagement à compléter</p>{/if}
			</div>
		</div>
		{#if t?.prochain}
			<div class="palier">
				<p>{t.prochain}</p>
				<span class="barre" aria-hidden="true"><span style:width="{t.part}%"></span></span>
			</div>
		{/if}
	</section>
{/if}

<style>
	.anciennete {
		display: flex;
		flex-direction: column;
		gap: var(--espace-16);
		padding: var(--espace-16) var(--espace-20);
		border: 1px solid transparent;
		box-shadow: var(--ombre-carte);
		border-radius: var(--rayon-grand);
		background: var(--surface);
	}
	.haut {
		display: flex;
		align-items: center;
		gap: var(--espace-16);
	}
	.texte {
		display: flex;
		flex-direction: column;
		gap: 0;
		min-width: 0;
	}
	p {
		margin: 0;
	}
	.nombre {
		font: 700 var(--texte-30) / 1 var(--police-titre);
	}
	.sous,
	.completer {
		color: var(--doux);
	}
	.echelon {
		margin-top: var(--espace-4);
		font-weight: 600;
	}
	.palier {
		display: flex;
		flex-direction: column;
		gap: var(--espace-8);
		padding-top: var(--espace-12);
		border-top: 1px solid var(--trait-doux);
		color: var(--doux);
		font-size: var(--texte-15);
	}
	.barre {
		height: 4px;
		border-radius: 2px;
		background: var(--statut-neutre-fond);
		overflow: hidden;
	}
	.barre span {
		display: block;
		height: 100%;
		background: var(--encre);
	}
</style>
