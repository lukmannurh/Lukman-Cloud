ALTER TABLE `skills` ADD `composite_score` real DEFAULT 0;--> statement-breakpoint
ALTER TABLE `skills` ADD `bayesian_rating` real DEFAULT 0;--> statement-breakpoint
ALTER TABLE `skills` ADD `trending_score` real DEFAULT 0;--> statement-breakpoint
ALTER TABLE `skills` ADD `favorite_count` integer DEFAULT 0;--> statement-breakpoint
CREATE INDEX `idx_skills_composite_score` ON `skills` (`composite_score`);--> statement-breakpoint
CREATE INDEX `idx_skills_trending_score` ON `skills` (`trending_score`);