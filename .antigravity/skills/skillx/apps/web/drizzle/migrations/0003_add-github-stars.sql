-- Add github_stars column to skills table (separate from install_count)
ALTER TABLE `skills` ADD COLUMN `github_stars` integer DEFAULT 0;
