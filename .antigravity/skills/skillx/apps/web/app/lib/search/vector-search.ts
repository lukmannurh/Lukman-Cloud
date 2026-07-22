/**
 * Vectorize semantic search module for skill discovery.
 * Uses Cloudflare Vectorize with 768-dim embeddings and cosine similarity.
 * Supports pre-filtering by category/is_paid via Vectorize metadata filters.
 */

import { embedTexts } from '~/lib/vectorize/embed-text';

export interface VectorResult {
  skill_id: string;
  similarity_score: number;
  rank: number;
}

export interface VectorFilters {
  category?: string;
  is_paid?: boolean;
}

/**
 * Search skills using semantic vector similarity.
 * Handles chunked skills by deduplicating and taking max score per skill.
 *
 * @param vectorize - Vectorize index binding
 * @param ai - Workers AI binding for embeddings
 * @param query - Search query string
 * @param limit - Maximum unique skills to return (default: 20)
 * @param filters - Optional category/is_paid metadata filters
 * @returns Array of semantic search results with similarity scores
 */
export async function vectorSearch(
  vectorize: VectorizeIndex,
  ai: Ai,
  query: string,
  limit = 20,
  filters?: VectorFilters
): Promise<VectorResult[]> {
  if (!query.trim()) {
    return [];
  }

  try {
    // Generate embedding for the search query
    const embeddings = await embedTexts(ai, [query]);
    const queryVector = embeddings[0];

    if (!queryVector || queryVector.length === 0) {
      console.error('Failed to generate query embedding');
      return [];
    }

    // Build Vectorize metadata filter from search filters
    const vectorFilter: Record<string, string | number> = {};
    if (filters?.category) {
      vectorFilter.category = filters.category;
    }
    if (filters?.is_paid !== undefined) {
      vectorFilter.is_paid = filters.is_paid ? 1 : 0;
    }

    // Query Vectorize index with higher limit to account for chunked skills
    const vectorResults = await vectorize.query(queryVector, {
      topK: limit * 3,
      returnMetadata: true,
      ...(Object.keys(vectorFilter).length > 0 && { filter: vectorFilter }),
    });

    // Deduplicate by skill_id, keeping the highest similarity score
    // (multiple chunks per skill -> take best match)
    const skillScores = new Map<string, number>();

    for (const match of vectorResults.matches) {
      const skillId = match.metadata?.skill_id as string | undefined;
      if (!skillId) continue;

      const currentScore = skillScores.get(skillId);
      if (currentScore === undefined || match.score > currentScore) {
        skillScores.set(skillId, match.score);
      }
    }

    // Convert to array, sort by score descending, and limit results
    const deduplicatedResults = Array.from(skillScores.entries())
      .map(([skill_id, similarity_score]) => ({
        skill_id,
        similarity_score,
      }))
      .sort((a, b) => b.similarity_score - a.similarity_score)
      .slice(0, limit);

    // Add rank position
    return deduplicatedResults.map((r, i) => ({
      ...r,
      rank: i + 1,
    }));
  } catch (error) {
    console.error('Vector search error:', error);
    return [];
  }
}
