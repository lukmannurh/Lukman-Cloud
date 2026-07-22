/**
 * Shared scoring utility functions used by both search boost-scoring
 * and leaderboard composite scoring modules.
 */

/** Log-scale normalization: compresses large ranges to 0-1 */
export function logNormalize(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.log(1 + value) / Math.log(1 + max);
}

/** Exponential recency decay. Half-life ~140 days (lambda=0.005). */
export function recencyScore(updatedAt: Date | null): number {
  if (!updatedAt) return 0;
  const daysSinceUpdate =
    (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);
  return Math.exp(-0.005 * daysSinceUpdate);
}
