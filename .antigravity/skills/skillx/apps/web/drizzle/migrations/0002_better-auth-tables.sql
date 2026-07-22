-- Better Auth tables migration
-- These tables are required by better-auth for authentication

-- User table
CREATE TABLE IF NOT EXISTS `user` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `email` text NOT NULL,
  `emailVerified` integer DEFAULT 0,
  `image` text,
  `createdAt` integer NOT NULL,
  `updatedAt` integer NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS `user_email_unique` ON `user` (`email`);

-- Session table
CREATE TABLE IF NOT EXISTS `session` (
  `id` text PRIMARY KEY NOT NULL,
  `userId` text NOT NULL REFERENCES `user`(`id`) ON DELETE CASCADE,
  `token` text NOT NULL,
  `expiresAt` integer NOT NULL,
  `ipAddress` text,
  `userAgent` text,
  `createdAt` integer NOT NULL,
  `updatedAt` integer NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS `session_token_unique` ON `session` (`token`);
CREATE INDEX IF NOT EXISTS `idx_session_user` ON `session` (`userId`);

-- Account table (OAuth providers)
CREATE TABLE IF NOT EXISTS `account` (
  `id` text PRIMARY KEY NOT NULL,
  `userId` text NOT NULL REFERENCES `user`(`id`) ON DELETE CASCADE,
  `accountId` text NOT NULL,
  `providerId` text NOT NULL,
  `accessToken` text,
  `refreshToken` text,
  `accessTokenExpiresAt` integer,
  `refreshTokenExpiresAt` integer,
  `scope` text,
  `idToken` text,
  `password` text,
  `createdAt` integer NOT NULL,
  `updatedAt` integer NOT NULL
);
CREATE INDEX IF NOT EXISTS `idx_account_user` ON `account` (`userId`);
CREATE UNIQUE INDEX IF NOT EXISTS `account_provider_unique` ON `account` (`userId`, `providerId`, `accountId`);

-- Verification table (email verification, password reset, etc.)
CREATE TABLE IF NOT EXISTS `verification` (
  `id` text PRIMARY KEY NOT NULL,
  `identifier` text NOT NULL,
  `value` text NOT NULL,
  `expiresAt` integer NOT NULL,
  `createdAt` integer NOT NULL,
  `updatedAt` integer NOT NULL
);
CREATE INDEX IF NOT EXISTS `idx_verification_identifier` ON `verification` (`identifier`);
