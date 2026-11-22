CREATE TABLE `fete_centre` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nom` text NOT NULL,
	`debut` text NOT NULL,
	`fin` text NOT NULL,
	`equipe_id` integer NOT NULL,
	`cree_par` text NOT NULL,
	`cree_le` text NOT NULL,
	FOREIGN KEY (`equipe_id`) REFERENCES `equipe`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `fete_centre_debut` ON `fete_centre` (`debut`);--> statement-breakpoint
CREATE TABLE `garde_fete_centre` (
	`annee` integer NOT NULL,
	`nom` text NOT NULL,
	`equipe_id` integer NOT NULL,
	PRIMARY KEY(`annee`, `nom`),
	FOREIGN KEY (`equipe_id`) REFERENCES `equipe`(`id`) ON UPDATE no action ON DELETE no action
);
