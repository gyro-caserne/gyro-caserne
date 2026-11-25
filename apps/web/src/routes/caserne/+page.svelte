<script lang="ts">
	import { pluriel } from '#lib/pluriel.ts';
	import EnTetePage from '#lib/ui/EnTetePage.svelte';
	import ListeRangees from '#lib/ui/ListeRangees.svelte';
	import Rangee from '#lib/ui/Rangee.svelte';

	let { data } = $props();

	type Lien = { href: string; titre: string; texte?: string; valeur?: string };
	const organisation: Lien[] = $derived([
		// La liste des agents : pas pour une personne extérieure (réserve citoyenne), venue pour réserver.
		...(data.exterieur ? [] : [{ href: '/agents', titre: 'Agents', valeur: data.agents === undefined ? undefined : pluriel(data.agents, 'agent') }]),
		// Pour qui peut nommer, ce qui est à pourvoir.
		...(data.comites ? [{ href: '/comites', titre: 'Qui fait quoi', texte: 'Les comités, les rôles et qui les tient', valeur: data.aPourvoir ? `${data.aPourvoir} à pourvoir` : undefined }] : []),
		// Le suivi du centre : pour le chef, l'adjoint et le super administrateur (lu avec la cloche, sans requête de plus).
		...(data.suivi === null || data.suivi === undefined ? [] : [{ href: '/suivi', titre: 'Suivi du centre', texte: 'Ce qui s’est passé au centre', valeur: data.suivi ? pluriel(data.suivi, 'nouveauté') : undefined }]),
		...(data.peutReglages ? [{ href: '/reglages', titre: 'Réglages', texte: 'Créer les comités et les rôles, régler leurs droits' }] : [])
	]);
	const materiel: Lien[] = $derived([
		...(data.engins === null ? [] : [{ href: '/engins', titre: 'Engins', texte: 'Leur état et leur fiche de prise de garde', valeur: data.engins === undefined ? undefined : pluriel(data.engins, 'engin') }]),
		...(data.anomalies === null || data.anomalies === undefined ? [] : [{ href: '/engins/anomalies', titre: 'Anomalies', texte: 'Ce qui est signalé sur les engins, jusqu’à la réparation', valeur: data.anomalies ? pluriel(data.anomalies, 'ouverte', 'ouvertes') : 'Aucune ouverte' }]),
		{ href: '/reservations', titre: 'Réservations', texte: 'La VL et le matériel de l’amicale' },
		// Comme « Qui fait quoi » : pour les agents du centre, pas pour le compte de la réserve citoyenne.
		// Une seule entrée pour tous les référents, habillement compris (l'ancienne adresse /habillement y mène encore).
		...(data.comites ? [{ href: '/demandes', titre: 'Faire une demande', texte: 'Une tenue, la pharmacie, le matériel, et suivre ses demandes' }] : [])
	]);
</script>

<svelte:head>
	<title>Caserne</title>
</svelte:head>

<div class="page">
	<EnTetePage titre="Caserne" />
	<div class="colonnes">
		{#each [{ titre: 'Organisation', liens: organisation }, { titre: 'Matériel', liens: materiel }].filter((g) => g.liens.length > 0) as g (g.titre)}
			<ListeRangees titre={g.titre}>
				{#each g.liens as l (l.href)}
					<li><Rangee href={l.href} titre={l.titre} sous={l.texte} valeur={l.valeur} /></li>
				{/each}
			</ListeRangees>
		{/each}
	</div>
</div>

<style>
	.page,
	.colonnes {
		display: flex;
		flex-direction: column;
		gap: var(--espace-24);
	}
	@media (min-width: 1024px) {
		.colonnes {
			display: grid;
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
			align-items: start;
			gap: var(--espace-32);
		}
	}
</style>
