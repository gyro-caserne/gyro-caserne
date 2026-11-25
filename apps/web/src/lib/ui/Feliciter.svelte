<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PalierDuJour } from '@gyro-caserne/socle';
	import Bouton from './Bouton.svelte';
	import Pastille from './Pastille.svelte';

	// Le geste sous un palier d'ancienneté du jour : « Féliciter » (un appui, l'agent est prévenu), puis « Félicité ».
	// Rien pour son propre palier. L'action revient sur la page d'où l'on vient.
	let { p, retour }: { p: PalierDuJour; retour: string } = $props();
	// Un double appui n'envoie qu'une félicitation.
	let envoi = $state(false);
</script>

{#if p.geste === 'felicite'}
	<Pastille ton="ok">Félicité<span class="masque">{` ${p.prenom} ${p.nom}`}</span></Pastille>
{:else if p.geste === 'feliciter'}
	<form method="POST" action="/echanges?/feliciter" use:enhance={() => {
		envoi = true;
		return async ({ update }) => {
			await update();
			envoi = false;
		};
	}}>
		<input type="hidden" name="id" value={p.id} />
		<input type="hidden" name="retour" value={retour} />
		<Bouton type="submit" variante="secondaire" desactive={envoi}>Féliciter<span class="masque">{` ${p.prenom} ${p.nom}`}</span></Bouton>
	</form>
{/if}

<style>
	form {
		flex: none;
	}
</style>
