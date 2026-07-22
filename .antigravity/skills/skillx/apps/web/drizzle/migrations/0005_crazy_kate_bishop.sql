CREATE TABLE `installs` (
	`id` text PRIMARY KEY NOT NULL,
	`skill_id` text NOT NULL,
	`user_id` text,
	`device_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`skill_id`) REFERENCES `skills`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_installs_skill` ON `installs` (`skill_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_installs_user` ON `installs` (`skill_id`,`user_id`) WHERE user_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_installs_device` ON `installs` (`skill_id`,`device_id`) WHERE device_id IS NOT NULL;