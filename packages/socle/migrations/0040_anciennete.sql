CREATE TABLE `avis_anciennete` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`personne_id` integer NOT NULL,
	`agent_id` integer NOT NULL,
	`auteur_id` integer,
	`annees` integer NOT NULL,
	`jour` text NOT NULL,
	`titre` text NOT NULL,
	`texte` text NOT NULL,
	`url` text NOT NULL,
	`cree_le` text NOT NULL,
	`lue_le` text,
	FOREIGN KEY (`personne_id`) REFERENCES `personne`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`agent_id`) REFERENCES `personne`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`auteur_id`) REFERENCES `personne`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `avis_anciennete_unique` ON `avis_anciennete` (`personne_id`,`agent_id`,`annees`,`auteur_id`);--> statement-breakpoint
CREATE INDEX `avis_anciennete_personne` ON `avis_anciennete` (`personne_id`,`lue_le`);--> statement-breakpoint
CREATE TABLE `reglage_anciennete` (
	`id` integer PRIMARY KEY NOT NULL,
	`paliers` text NOT NULL
);
