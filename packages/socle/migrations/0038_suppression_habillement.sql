-- Généré par drizzle-kit, puis retouché à la main (décision 0044). Il n'y a pas de vraie demande d'habillement en production : à la
-- demande du porteur, les anciennes tables sont supprimées tout de suite, après la reprise 0037, dans l'ordre des clés étrangères.
-- Puis le droit GERER_HABILLEMENT disparaît : ses lignes, puis la liste figée par les CHECK, en reconstruisant profil_droit et
-- responsabilite_droit comme 0022 (sans « PRAGMA foreign_keys », sans effet dans la transaction de D1 ; rowid recopié).
DROP TABLE `avis_habillement`;--> statement-breakpoint
DROP TABLE `fil_habillement`;--> statement-breakpoint
DROP TABLE `demande_habillement`;--> statement-breakpoint
DELETE FROM `profil_droit` WHERE `droit` = 'GERER_HABILLEMENT';--> statement-breakpoint
DELETE FROM `responsabilite_droit` WHERE `droit` = 'GERER_HABILLEMENT';--> statement-breakpoint
CREATE TABLE `__new_profil_droit` (
	`profil_id` integer NOT NULL,
	`droit` text NOT NULL,
	`perimetre_type` text NOT NULL,
	`perimetre_id` integer,
	FOREIGN KEY (`profil_id`) REFERENCES `profil`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "profil_droit_droit" CHECK("droit" IN ('VOIR_PLANNING', 'VOIR_ANNUAIRE', 'VOIR_ENGINS', 'VOIR_ANOMALIES', 'SIGNALER_ANOMALIE', 'SIGNALER_BESOIN_STOCK', 'DEMANDER_REMPLACEMENT', 'DECLARER_DISPONIBILITE', 'UTILISER_MESSAGERIE', 'FAIRE_PRISE_DE_GARDE', 'PRENDRE_EN_CHARGE_ANOMALIE', 'TRAITER_ANOMALIE', 'GERER_FICHES', 'GERER_STOCK', 'GERER_PLANNING', 'VALIDER_REMPLACEMENT', 'VOIR_MOTIFS_ABSENCE', 'LIRE_SALON', 'PUBLIER_SALON', 'MODERER_SALON', 'EPINGLER_SALON', 'RESERVER', 'GERER_RESERVATIONS', 'MODERER_MESSAGERIE', 'GERER_LISTES', 'GERER_ACCES', 'GERER_COMITES', 'ATTRIBUER_RESPONSABILITE')),
	CONSTRAINT "profil_droit_perimetre_type" CHECK("perimetre_type" IN ('centre', 'equipe', 'comite', 'salon', 'ressource')),
	CONSTRAINT "profil_droit_perimetre_id" CHECK(("perimetre_type" = 'centre') = ("perimetre_id" IS NULL))
);--> statement-breakpoint
INSERT INTO `__new_profil_droit`("rowid", "profil_id", "droit", "perimetre_type", "perimetre_id") SELECT "rowid", "profil_id", "droit", "perimetre_type", "perimetre_id" FROM `profil_droit`;--> statement-breakpoint
DROP TABLE `profil_droit`;--> statement-breakpoint
ALTER TABLE `__new_profil_droit` RENAME TO `profil_droit`;--> statement-breakpoint
CREATE TABLE `__new_responsabilite_droit` (
	`responsabilite_id` integer NOT NULL,
	`droit` text NOT NULL,
	`verrouille` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`responsabilite_id`, `droit`),
	FOREIGN KEY (`responsabilite_id`) REFERENCES `responsabilite`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "responsabilite_droit_droit" CHECK("droit" IN ('VOIR_PLANNING', 'VOIR_ANNUAIRE', 'VOIR_ENGINS', 'VOIR_ANOMALIES', 'SIGNALER_ANOMALIE', 'SIGNALER_BESOIN_STOCK', 'DEMANDER_REMPLACEMENT', 'DECLARER_DISPONIBILITE', 'UTILISER_MESSAGERIE', 'FAIRE_PRISE_DE_GARDE', 'PRENDRE_EN_CHARGE_ANOMALIE', 'TRAITER_ANOMALIE', 'GERER_FICHES', 'GERER_STOCK', 'GERER_PLANNING', 'VALIDER_REMPLACEMENT', 'VOIR_MOTIFS_ABSENCE', 'LIRE_SALON', 'PUBLIER_SALON', 'MODERER_SALON', 'EPINGLER_SALON', 'RESERVER', 'GERER_RESERVATIONS', 'MODERER_MESSAGERIE', 'GERER_LISTES', 'GERER_ACCES', 'GERER_COMITES', 'ATTRIBUER_RESPONSABILITE')),
	CONSTRAINT "responsabilite_droit_verrouille" CHECK("verrouille" IN (0, 1))
);--> statement-breakpoint
INSERT INTO `__new_responsabilite_droit`("rowid", "responsabilite_id", "droit", "verrouille") SELECT "rowid", "responsabilite_id", "droit", "verrouille" FROM `responsabilite_droit`;--> statement-breakpoint
DROP TABLE `responsabilite_droit`;--> statement-breakpoint
ALTER TABLE `__new_responsabilite_droit` RENAME TO `responsabilite_droit`;
