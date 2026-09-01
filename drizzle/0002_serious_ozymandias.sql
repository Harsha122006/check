ALTER TABLE `outfits` ADD `imageFingerprint` varchar(64);--> statement-breakpoint
CREATE INDEX `outfits_user_fingerprint_idx` ON `outfits` (`userId`,`imageFingerprint`);