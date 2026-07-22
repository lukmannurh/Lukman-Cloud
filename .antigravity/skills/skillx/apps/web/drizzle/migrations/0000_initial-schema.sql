-- Skills table
CREATE TABLE IF NOT EXISTS `skills` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `slug` text NOT NULL,
  `description` text NOT NULL,
  `content` text NOT NULL,
  `author` text NOT NULL,
  `source_url` text,
  `category` text NOT NULL,
  `install_command` text,
  `version` text DEFAULT '1.0.0',
  `is_paid` integer DEFAULT 0,
  `price_cents` integer DEFAULT 0,
  `avg_rating` real DEFAULT 0,
  `rating_count` integer DEFAULT 0,
  `install_count` integer DEFAULT 0,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS `skills_slug_unique` ON `skills` (`slug`);
CREATE INDEX IF NOT EXISTS `idx_skills_category` ON `skills` (`category`);
CREATE INDEX IF NOT EXISTS `idx_skills_author` ON `skills` (`author`);
CREATE INDEX IF NOT EXISTS `idx_skills_avg_rating` ON `skills` (`avg_rating`);

-- Ratings table
CREATE TABLE IF NOT EXISTS `ratings` (
  `id` text PRIMARY KEY NOT NULL,
  `skill_id` text NOT NULL REFERENCES `skills`(`id`) ON DELETE CASCADE,
  `user_id` text NOT NULL,
  `score` real NOT NULL,
  `is_agent` integer DEFAULT 0,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS `idx_ratings_user_skill` ON `ratings` (`user_id`, `skill_id`);
CREATE INDEX IF NOT EXISTS `idx_ratings_skill` ON `ratings` (`skill_id`);

-- Reviews table
CREATE TABLE IF NOT EXISTS `reviews` (
  `id` text PRIMARY KEY NOT NULL,
  `skill_id` text NOT NULL REFERENCES `skills`(`id`) ON DELETE CASCADE,
  `user_id` text NOT NULL,
  `content` text NOT NULL,
  `is_agent` integer DEFAULT 0,
  `created_at` integer NOT NULL
);
CREATE INDEX IF NOT EXISTS `idx_reviews_skill` ON `reviews` (`skill_id`);
CREATE INDEX IF NOT EXISTS `idx_reviews_user` ON `reviews` (`user_id`);

-- Favorites table
CREATE TABLE IF NOT EXISTS `favorites` (
  `user_id` text NOT NULL,
  `skill_id` text NOT NULL REFERENCES `skills`(`id`) ON DELETE CASCADE,
  `created_at` integer NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS `idx_favorites_pk` ON `favorites` (`user_id`, `skill_id`);
CREATE INDEX IF NOT EXISTS `idx_favorites_skill` ON `favorites` (`skill_id`);

-- Usage stats table
CREATE TABLE IF NOT EXISTS `usage_stats` (
  `id` text PRIMARY KEY NOT NULL,
  `skill_id` text NOT NULL REFERENCES `skills`(`id`) ON DELETE CASCADE,
  `user_id` text,
  `model` text,
  `outcome` text NOT NULL,
  `duration_ms` integer,
  `created_at` integer NOT NULL
);
CREATE INDEX IF NOT EXISTS `idx_usage_skill` ON `usage_stats` (`skill_id`);
CREATE INDEX IF NOT EXISTS `idx_usage_created` ON `usage_stats` (`created_at`);

-- API keys table
CREATE TABLE IF NOT EXISTS `api_keys` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `name` text NOT NULL DEFAULT 'Default',
  `key_hash` text NOT NULL,
  `key_prefix` text NOT NULL,
  `last_used_at` integer,
  `revoked_at` integer,
  `created_at` integer NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS `api_keys_key_hash_unique` ON `api_keys` (`key_hash`);
CREATE INDEX IF NOT EXISTS `idx_api_keys_user` ON `api_keys` (`user_id`);
CREATE INDEX IF NOT EXISTS `idx_api_keys_hash` ON `api_keys` (`key_hash`);
