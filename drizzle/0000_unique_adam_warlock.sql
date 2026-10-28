CREATE TABLE `pong_rooms` (
	`code` text PRIMARY KEY NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`data` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`creator_key` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `pong_rooms_expiry` ON `pong_rooms` (`expires_at`);--> statement-breakpoint
CREATE INDEX `pong_rooms_creator` ON `pong_rooms` (`creator_key`,`created_at`);