import { goto } from '$app/navigation';
import type { SubmitFunction } from '$app/forms';

// L'envoi d'un volet : un seul à la fois ; une réussite ferme le volet (l'adresse sans lui, données relues) et s'annonce sur la page ;
// un refus laisse le volet ouvert avec ses erreurs.
export function surEnvoi(fermer: () => string, onreussite: (message: string) => void) {
	let envoi = $state(false);
	const soumettre: SubmitFunction = () => {
		envoi = true;
		return async ({ result, update }) => {
			try {
				if (result.type === 'success') {
					await goto(fermer(), { replace: true, reset: false, refreshAll: true });
					onreussite(String(result.data?.succes ?? ''));
				} else await update();
			} finally {
				envoi = false;
			}
		};
	};
	return {
		get envoi() {
			return envoi;
		},
		soumettre
	};
}
