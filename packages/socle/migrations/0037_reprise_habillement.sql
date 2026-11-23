-- Écrite à la main (décision 0044). Les demandes d'habillement passent dans les demandes aux référents.
-- Elle ne fait qu'ajouter : les tables de l'habillement ne sont ni modifiées ni supprimées. Rejouée, elle ne duplique rien.
-- Le rôle cible : de portée centre, hors rôles système, non archivé, sans autre réglage de demandes ; d'abord celui qui porte
-- GERER_HABILLEMENT, et parmi eux celui qui a un titulaire en cours, puis le natif « Référent habillement » ; à défaut un rôle
-- créé à partir du modèle. Sans rôle cible, rien n'est recopié, et la ligne du journal le dit.
-- 1. Le réglage du rôle : En stock, Commandée au SDIS, puis Livrée. Jamais si un rôle a déjà ce réglage, même décoché, ou
-- si la reprise est faite : une relance ne règle pas un second rôle.
UPDATE `responsabilite`
SET `demandes` = '{"etapes":[{"id":"estock","nom":"En stock"},{"id":"ecommande","nom":"Commandée au SDIS"}],"derniere":"Livrée"}'
WHERE `demandes` IS NULL
	AND NOT EXISTS (SELECT 1 FROM `demande_referent` WHERE `habillement_id` IS NOT NULL)
	AND NOT EXISTS (SELECT 1 FROM `responsabilite` WHERE `demandes` LIKE '%"id":"estock"%' OR `demandes_gardees` LIKE '%"id":"estock"%')
	AND `id` = (
		SELECT r.`id` FROM `responsabilite` r
		WHERE r.`type_perimetre` = 'centre' AND r.`systeme` IS NULL AND r.`archivee_le` IS NULL
			AND (r.`demandes` IS NULL OR r.`demandes` = '{"etapes":[{"id":"estock","nom":"En stock"},{"id":"ecommande","nom":"Commandée au SDIS"}],"derniere":"Livrée"}')
			AND (r.`modele` = 'referent_habillement' OR EXISTS (SELECT 1 FROM `responsabilite_droit` x WHERE x.`responsabilite_id` = r.`id` AND x.`droit` = 'GERER_HABILLEMENT'))
		ORDER BY EXISTS (SELECT 1 FROM `responsabilite_droit` x WHERE x.`responsabilite_id` = r.`id` AND x.`droit` = 'GERER_HABILLEMENT') DESC,
			EXISTS (SELECT 1 FROM `attribution` a WHERE a.`responsabilite_id` = r.`id` AND a.`perimetre_type` = 'centre' AND a.`debut` <= date('now') AND (a.`fin` IS NULL OR a.`fin` >= date('now'))) DESC,
			r.`nom` = 'Référent habillement' DESC, r.`id`
		LIMIT 1
	);
--> statement-breakpoint
-- 2. Les demandes, dans l'ordre, vers le rôle réglé. Question posée : Prise en compte, question en attente ; prise en compte avec
-- une réponse arrivée après la dernière question : réponse à lire ; traitée : En stock ou Commandée au SDIS ; livrée : Livrée,
-- le lieu devient le mot de fin ; refusée : le mot du refus. Dates, auteur et qui la suit sont gardés.
INSERT INTO `demande_referent` (`responsabilite_id`, `demandeur_id`, `texte`, `etape`, `question`, `prise_par`, `mot`, `cree_le`, `maj_le`, `fin_le`, `habillement_id`)
SELECT
	c.`id`, h.`demandeur_id`, h.`texte`,
	CASE h.`etape`
		WHEN 'demandee' THEN 'demandee'
		WHEN 'prise' THEN 'prise'
		WHEN 'question' THEN 'prise'
		WHEN 'traitee' THEN CASE h.`issue` WHEN 'stock' THEN 'estock' WHEN 'commande' THEN 'ecommande' ELSE 'prise' END
		WHEN 'livree' THEN 'faite'
		ELSE h.`etape`
	END,
	CASE
		WHEN h.`etape` = 'question' THEN 'posee'
		WHEN h.`etape` = 'prise' AND EXISTS (
			SELECT 1 FROM `fil_habillement` f WHERE f.`demande_id` = h.`id` AND f.`quoi` = 'reponse'
				AND f.`id` > coalesce((SELECT max(q.`id`) FROM `fil_habillement` q WHERE q.`demande_id` = h.`id` AND q.`quoi` = 'question'), 0)
		) THEN 'repondue'
	END,
	h.`prise_par`,
	CASE h.`etape`
		WHEN 'livree' THEN h.`livraison`
		WHEN 'refusee' THEN (SELECT f.`texte` FROM `fil_habillement` f WHERE f.`demande_id` = h.`id` AND f.`quoi` = 'refus' ORDER BY f.`id` DESC LIMIT 1)
	END,
	h.`cree_le`, h.`maj_le`, h.`fin_le`, h.`id`
FROM `demande_habillement` h
JOIN `responsabilite` c ON c.`demandes` = '{"etapes":[{"id":"estock","nom":"En stock"},{"id":"ecommande","nom":"Commandée au SDIS"}],"derniere":"Livrée"}'
	AND c.`id` = (
		SELECT r.`id` FROM `responsabilite` r
		WHERE r.`type_perimetre` = 'centre' AND r.`systeme` IS NULL AND r.`archivee_le` IS NULL
			AND (r.`demandes` IS NULL OR r.`demandes` = '{"etapes":[{"id":"estock","nom":"En stock"},{"id":"ecommande","nom":"Commandée au SDIS"}],"derniere":"Livrée"}')
			AND (r.`modele` = 'referent_habillement' OR EXISTS (SELECT 1 FROM `responsabilite_droit` x WHERE x.`responsabilite_id` = r.`id` AND x.`droit` = 'GERER_HABILLEMENT'))
		ORDER BY EXISTS (SELECT 1 FROM `responsabilite_droit` x WHERE x.`responsabilite_id` = r.`id` AND x.`droit` = 'GERER_HABILLEMENT') DESC,
			EXISTS (SELECT 1 FROM `attribution` a WHERE a.`responsabilite_id` = r.`id` AND a.`perimetre_type` = 'centre' AND a.`debut` <= date('now') AND (a.`fin` IS NULL OR a.`fin` >= date('now'))) DESC,
			r.`nom` = 'Référent habillement' DESC, r.`id`
		LIMIT 1
	)
WHERE NOT EXISTS (SELECT 1 FROM `demande_referent` x WHERE x.`habillement_id` = h.`id`)
ORDER BY h.`id`;
--> statement-breakpoint
-- 3. Le fil, dans l'ordre d'origine. Chaque ligne garde son origine dans `jeton` (« habillement:<numéro> »).
INSERT INTO `fil_demande_referent` (`demande_id`, `quoi`, `etape`, `nom_etape`, `texte`, `par`, `le`, `jeton`)
SELECT
	d.`id`,
	CASE f.`quoi` WHEN 'stock' THEN 'etape' WHEN 'commande' THEN 'etape' WHEN 'livraison' THEN 'fin' ELSE f.`quoi` END,
	CASE f.`quoi` WHEN 'stock' THEN 'estock' WHEN 'commande' THEN 'ecommande' WHEN 'livraison' THEN 'faite' END,
	CASE f.`quoi` WHEN 'stock' THEN 'En stock' WHEN 'commande' THEN 'Commandée au SDIS' WHEN 'livraison' THEN 'Livrée' END,
	f.`texte`, f.`par`, f.`le`, 'habillement:' || f.`id`
FROM `fil_habillement` f
JOIN `demande_referent` d ON d.`habillement_id` = f.`demande_id`
WHERE NOT EXISTS (SELECT 1 FROM `fil_demande_referent` x WHERE x.`jeton` = 'habillement:' || f.`id`)
ORDER BY f.`id`;
--> statement-breakpoint
-- 4. Les avis non lus d'une demande reprise, vers sa nouvelle adresse.
INSERT INTO `avis_demande_referent` (`personne_id`, `titre`, `texte`, `url`, `cree_le`, `lue_le`)
SELECT a.`personne_id`, a.`titre`, a.`texte`, '/demandes/' || d.`id`, a.`cree_le`, NULL
FROM `avis_habillement` a
JOIN `demande_referent` d ON d.`habillement_id` IS NOT NULL AND a.`url` = '/habillement/' || d.`habillement_id`
WHERE a.`lue_le` IS NULL
	AND NOT EXISTS (SELECT 1 FROM `avis_demande_referent` x WHERE x.`personne_id` = a.`personne_id` AND x.`url` = '/demandes/' || d.`id` AND x.`titre` = a.`titre` AND x.`cree_le` = a.`cree_le`)
ORDER BY a.`id`;
--> statement-breakpoint
-- 5. Au journal, une fois, s'il y avait des demandes : combien il y en avait, combien sont recopiées, et vers quel rôle.
INSERT INTO `journal` (`quand`, `acteur`, `action`, `cible_type`, `cible_id`, `details`)
SELECT
	strftime('%Y-%m-%dT%H:%M', 'now'), 'migration', 'reprendre_habillement', 'responsabilite',
	(SELECT `responsabilite_id` FROM `demande_referent` WHERE `habillement_id` IS NOT NULL ORDER BY `id` LIMIT 1),
	json_object(
		'demandes', (SELECT count(*) FROM `demande_habillement`),
		'recopiees', (SELECT count(*) FROM `demande_referent` WHERE `habillement_id` IS NOT NULL),
		'fil', (SELECT count(*) FROM `fil_demande_referent` WHERE `jeton` LIKE 'habillement:%'),
		'avis', (SELECT count(*) FROM `avis_habillement` a JOIN `demande_referent` d ON d.`habillement_id` IS NOT NULL AND a.`url` = '/habillement/' || d.`habillement_id` WHERE a.`lue_le` IS NULL)
	)
WHERE EXISTS (SELECT 1 FROM `demande_habillement`)
	AND NOT EXISTS (SELECT 1 FROM `journal` WHERE `action` = 'reprendre_habillement');
