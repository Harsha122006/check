CREATE TABLE `outfit_analyses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`outfitId` int NOT NULL,
	`outfitScore` int,
	`colorScore` int,
	`fitScore` int,
	`shoesScore` int,
	`stylingScore` int,
	`overallScore` int NOT NULL,
	`confidence` int NOT NULL,
	`verdict` text NOT NULL,
	`summary` text NOT NULL,
	`strengths` json NOT NULL,
	`improvements` json NOT NULL,
	`coverage` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `outfit_analyses_id` PRIMARY KEY(`id`),
	CONSTRAINT `outfit_analyses_outfit_unique` UNIQUE(`outfitId`)
);
--> statement-breakpoint
CREATE TABLE `outfits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`requestId` varchar(64) NOT NULL,
	`imageKey` varchar(512) NOT NULL,
	`imageUrl` varchar(768) NOT NULL,
	`originalName` varchar(255),
	`category` varchar(32),
	`analysisStatus` enum('processing','completed','failed') NOT NULL DEFAULT 'processing',
	`errorCode` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `outfits_id` PRIMARY KEY(`id`),
	CONSTRAINT `outfits_user_request_unique` UNIQUE(`userId`,`requestId`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
--> statement-breakpoint
CREATE INDEX `outfits_user_created_idx` ON `outfits` (`userId`,`createdAt`);