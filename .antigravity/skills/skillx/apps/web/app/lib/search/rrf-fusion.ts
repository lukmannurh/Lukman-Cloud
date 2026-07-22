/**
 * Reciprocal Rank Fusion (RRF) for combining multiple search result rankings
 * Standard algorithm for hybrid search fusion with k=60 constant
 */

const K = 60; // Standard RRF constant

export interface RankedResult {
  skill_id: string;
  rank: number;
}

export interface RRFResult {
  skill_id: string;
  rrf_score: number;
  semantic_rank: number | null;
  keyword_rank: number | null;
}

/**
 * Fuse semantic and keyword search results using Reciprocal Rank Fusion
 * Formula: RRF_score = sum(1 / (k + rank)) for each list where item appears
 *
 * @param semanticResults - Results from vector search with ranks
 * @param keywordResults - Results from FTS5 search with ranks
 * @returns Fused results sorted by RRF score descending
 */
export function reciprocalRankFusion(
  semanticResults: RankedResult[],
  keywordResults: RankedResult[]
): RRFResult[] {
  // Build maps for fast lookup of ranks
  const semanticRanks = new Map<string, number>();
  const keywordRanks = new Map<string, number>();

  for (const result of semanticResults) {
    semanticRanks.set(result.skill_id, result.rank);
  }

  for (const result of keywordResults) {
    keywordRanks.set(result.skill_id, result.rank);
  }

  // Collect all unique skill IDs from both result sets
  const allSkillIds = new Set<string>([
    ...semanticRanks.keys(),
    ...keywordRanks.keys(),
  ]);

  // Calculate RRF score for each skill
  const rrfResults: RRFResult[] = [];

  for (const skillId of allSkillIds) {
    const semanticRank = semanticRanks.get(skillId) ?? null;
    const keywordRank = keywordRanks.get(skillId) ?? null;

    let rrfScore = 0;

    // Add contribution from semantic search if present
    if (semanticRank !== null) {
      rrfScore += 1 / (K + semanticRank);
    }

    // Add contribution from keyword search if present
    if (keywordRank !== null) {
      rrfScore += 1 / (K + keywordRank);
    }

    rrfResults.push({
      skill_id: skillId,
      rrf_score: rrfScore,
      semantic_rank: semanticRank,
      keyword_rank: keywordRank,
    });
  }

  // Sort by RRF score descending (highest score = best match)
  return rrfResults.sort((a, b) => b.rrf_score - a.rrf_score);
}
