-- Reprise de l'habillement (migrations 0036 et 0037) : les nombres avant et après, état par état. Ne montre que des nombres.
-- Lancé de lui-même par « base-en-ligne », juste après les migrations, en préprod comme en production (résultat dans le journal du déploiement).
-- À retirer avec le lot qui supprimera les tables de l’habillement. À la main :
-- wrangler d1 execute <base> --remote --config centres/<id>/wrangler.jsonc --file docs/technique/comptage-reprise-habillement.sql
-- Une seule requête, sans UNION : D1 limite le nombre de termes d'un SELECT composé. « traitee sans issue » ne devrait jamais
-- arriver (l'ancien code mettait toujours une issue) ; s'il y en a, elles sont reprises en « Prise en compte » : l'écart de « prise »
-- s'explique par là. Pas de nombre « après » pour elle.
SELECT
	j.value AS quoi,
	CASE j.value
		WHEN 'demandee' THEN (SELECT count(*) FROM demande_habillement WHERE etape = 'demandee')
		WHEN 'prise' THEN (SELECT count(*) FROM demande_habillement WHERE etape = 'prise')
		WHEN 'question' THEN (SELECT count(*) FROM demande_habillement WHERE etape = 'question')
		WHEN 'stock' THEN (SELECT count(*) FROM demande_habillement WHERE etape = 'traitee' AND issue = 'stock')
		WHEN 'commande' THEN (SELECT count(*) FROM demande_habillement WHERE etape = 'traitee' AND issue = 'commande')
		WHEN 'traitee sans issue' THEN (SELECT count(*) FROM demande_habillement WHERE etape = 'traitee' AND issue IS NULL)
		WHEN 'livree' THEN (SELECT count(*) FROM demande_habillement WHERE etape = 'livree')
		WHEN 'refusee' THEN (SELECT count(*) FROM demande_habillement WHERE etape = 'refusee')
		WHEN 'annulee' THEN (SELECT count(*) FROM demande_habillement WHERE etape = 'annulee')
		WHEN 'fil' THEN (SELECT count(*) FROM fil_habillement)
		WHEN 'avis non lus' THEN (SELECT count(*) FROM avis_habillement a WHERE a.lue_le IS NULL AND EXISTS (SELECT 1 FROM demande_habillement h WHERE a.url = '/habillement/' || h.id))
	END AS avant,
	CASE j.value
		WHEN 'demandee' THEN (SELECT count(*) FROM demande_referent WHERE habillement_id IS NOT NULL AND etape = 'demandee')
		WHEN 'prise' THEN (SELECT count(*) FROM demande_referent WHERE habillement_id IS NOT NULL AND etape = 'prise' AND coalesce(question, '') <> 'posee')
		WHEN 'question' THEN (SELECT count(*) FROM demande_referent WHERE habillement_id IS NOT NULL AND etape = 'prise' AND question = 'posee')
		WHEN 'stock' THEN (SELECT count(*) FROM demande_referent WHERE habillement_id IS NOT NULL AND etape = 'estock')
		WHEN 'commande' THEN (SELECT count(*) FROM demande_referent WHERE habillement_id IS NOT NULL AND etape = 'ecommande')
		WHEN 'livree' THEN (SELECT count(*) FROM demande_referent WHERE habillement_id IS NOT NULL AND etape = 'faite')
		WHEN 'refusee' THEN (SELECT count(*) FROM demande_referent WHERE habillement_id IS NOT NULL AND etape = 'refusee')
		WHEN 'annulee' THEN (SELECT count(*) FROM demande_referent WHERE habillement_id IS NOT NULL AND etape = 'annulee')
		WHEN 'fil' THEN (SELECT count(*) FROM fil_demande_referent WHERE jeton LIKE 'habillement:%')
		WHEN 'avis non lus' THEN (SELECT count(*) FROM avis_demande_referent n JOIN demande_referent d ON d.habillement_id IS NOT NULL AND n.url = '/demandes/' || d.id
			WHERE EXISTS (SELECT 1 FROM avis_habillement a WHERE a.lue_le IS NULL AND a.personne_id = n.personne_id AND a.titre = n.titre AND a.cree_le = n.cree_le AND a.url = '/habillement/' || d.habillement_id))
	END AS apres
FROM json_each('["demandee","prise","question","stock","commande","traitee sans issue","livree","refusee","annulee","fil","avis non lus"]') j
ORDER BY j.key;
