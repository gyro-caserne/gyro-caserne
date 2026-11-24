ALTER TABLE `demande_referent` ADD `habillement_id` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `demande_referent_habillement` ON `demande_referent` (`habillement_id`);