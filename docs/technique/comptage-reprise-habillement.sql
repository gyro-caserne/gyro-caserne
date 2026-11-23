-- Reprise de l'habillement (migrations 0036 et 0037) : les nombres avant et après, état par état. Ne montre que des nombres.
-- À lancer en production juste après la mise en production :
-- wrangler d1 execute <base> --remote --file docs/technique/comptage-reprise-habillement.sql
SELECT 'demandee' AS quoi,
	(SELECT count(*) FROM demande_habillement WHERE etape = 'demandee') AS avant,
	(SELECT count(*) FROM demande_referent WHERE habillement_id IS NOT NULL AND etape = 'demandee') AS apres
UNION ALL SELECT 'prise',
	(SELECT count(*) FROM demande_habillement WHERE etape = 'prise'),
	(SELECT count(*) FROM demande_referent WHERE habillement_id IS NOT NULL AND etape = 'prise' AND coalesce(question, '') <> 'posee')
UNION ALL SELECT 'question',
	(SELECT count(*) FROM demande_habillement WHERE etape = 'question'),
	(SELECT count(*) FROM demande_referent WHERE habillement_id IS NOT NULL AND etape = 'prise' AND question = 'posee')
UNION ALL SELECT 'stock',
	(SELECT count(*) FROM demande_habillement WHERE etape = 'traitee' AND issue = 'stock'),
	(SELECT count(*) FROM demande_referent WHERE habillement_id IS NOT NULL AND etape = 'estock')
UNION ALL SELECT 'commande',
	(SELECT count(*) FROM demande_habillement WHERE etape = 'traitee' AND issue = 'commande'),
	(SELECT count(*) FROM demande_referent WHERE habillement_id IS NOT NULL AND etape = 'ecommande')
UNION ALL SELECT 'livree',
	(SELECT count(*) FROM demande_habillement WHERE etape = 'livree'),
	(SELECT count(*) FROM demande_referent WHERE habillement_id IS NOT NULL AND etape = 'faite')
UNION ALL SELECT 'refusee',
	(SELECT count(*) FROM demande_habillement WHERE etape = 'refusee'),
	(SELECT count(*) FROM demande_referent WHERE habillement_id IS NOT NULL AND etape = 'refusee')
UNION ALL SELECT 'annulee',
	(SELECT count(*) FROM demande_habillement WHERE etape = 'annulee'),
	(SELECT count(*) FROM demande_referent WHERE habillement_id IS NOT NULL AND etape = 'annulee')
UNION ALL SELECT 'fil',
	(SELECT count(*) FROM fil_habillement),
	(SELECT count(*) FROM fil_demande_referent WHERE jeton LIKE 'habillement:%')
UNION ALL SELECT 'avis non lus',
	(SELECT count(*) FROM avis_habillement a WHERE a.lue_le IS NULL AND EXISTS (SELECT 1 FROM demande_habillement h WHERE a.url = '/habillement/' || h.id)),
	(SELECT count(*) FROM avis_demande_referent n JOIN demande_referent d ON d.habillement_id IS NOT NULL AND n.url = '/demandes/' || d.id
		WHERE EXISTS (SELECT 1 FROM avis_habillement a WHERE a.lue_le IS NULL AND a.personne_id = n.personne_id AND a.titre = n.titre AND a.cree_le = n.cree_le AND a.url = '/habillement/' || d.habillement_id));
