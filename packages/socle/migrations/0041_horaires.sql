CREATE TABLE `reglage_court` (
	`id` integer PRIMARY KEY NOT NULL,
	`durees` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `annee_planning` ADD `horaires` text;