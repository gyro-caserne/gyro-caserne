CREATE TABLE `avis_demande_referent` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`personne_id` integer NOT NULL,
	`titre` text NOT NULL,
	`texte` text NOT NULL,
	`url` text NOT NULL,
	`cree_le` text NOT NULL,
	`lue_le` text,
	FOREIGN KEY (`personne_id`) REFERENCES `personne`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `avis_demande_referent_personne` ON `avis_demande_referent` (`personne_id`,`lue_le`);--> statement-breakpoint
CREATE TABLE `demande_referent` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`responsabilite_id` integer NOT NULL,
	`demandeur_id` integer NOT NULL,
	`texte` text NOT NULL,
	`etape` text DEFAULT 'demandee' NOT NULL,
	`question` text,
	`prise_par` integer,
	`mot` text,
	`cree_le` text NOT NULL,
	`maj_le` text NOT NULL,
	`fin_le` text,
	FOREIGN KEY (`responsabilite_id`) REFERENCES `responsabilite`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`demandeur_id`) REFERENCES `personne`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`prise_par`) REFERENCES `personne`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "demande_referent_etape" CHECK("etape" IN ('demandee', 'prise', 'faite', 'refusee', 'annulee') OR "etape" GLOB 'e?*'),
	CONSTRAINT "demande_referent_question" CHECK("question" IS NULL OR "question" IN ('posee', 'repondue'))
);
--> statement-breakpoint
CREATE INDEX `demande_referent_demandeur` ON `demande_referent` (`demandeur_id`);--> statement-breakpoint
CREATE INDEX `demande_referent_role` ON `demande_referent` (`responsabilite_id`,`fin_le`);--> statement-breakpoint
CREATE INDEX `demande_referent_fin` ON `demande_referent` (`fin_le`);--> statement-breakpoint
CREATE TABLE `fil_demande_referent` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`demande_id` integer NOT NULL,
	`quoi` text NOT NULL,
	`etape` text,
	`nom_etape` text,
	`texte` text,
	`par` integer NOT NULL,
	`le` text NOT NULL,
	`jeton` text,
	FOREIGN KEY (`demande_id`) REFERENCES `demande_referent`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`par`) REFERENCES `personne`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "fil_demande_referent_quoi" CHECK("quoi" IN ('prise', 'reprise', 'question', 'reponse', 'precision', 'etape', 'fin', 'refus', 'annulation'))
);
--> statement-breakpoint
CREATE INDEX `fil_demande_referent_demande` ON `fil_demande_referent` (`demande_id`);--> statement-breakpoint
ALTER TABLE `responsabilite` ADD `demandes` text;