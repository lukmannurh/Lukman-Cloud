import { chunkText } from './chunk-text';
import { embedTexts } from './embed-text';

interface SkillMetadata {
  skill_id: string;
  category: string;
  is_paid: number; // 0 or 1
  avg_rating: number;
  chunk_index: number;
}

/**
 * Index a skill by chunking, embedding, and upserting to Vectorize.
 *
 * @param vectorize - Vectorize binding
 * @param ai - Workers AI binding
 * @param skill - Skill object with id, category, is_paid, avg_rating, and text to index
 * @returns Number of vectors upserted
 */
export async function indexSkill(
  vectorize: VectorizeIndex,
  ai: Ai,
  skill: {
    id: string;
    name: string;
    description: string;
    content: string;
    category: string;
    is_paid: boolean;
    avg_rating: number;
  }
): Promise<number> {
  // Combine name, description, and content for comprehensive indexing
  const fullText = `${skill.name}\n\n${skill.description}\n\n${skill.content}`;

  // Chunk the text
  const chunks = chunkText(fullText, 512, 0.1);

  // Generate embeddings for all chunks
  const texts = chunks.map((chunk) => chunk.text);
  const embeddings = await embedTexts(ai, texts);

  // Prepare vectors with metadata
  const vectors = embeddings.map((embedding, idx) => ({
    id: `skill_${skill.id}_chunk_${chunks[idx].index}`,
    values: embedding,
    metadata: {
      skill_id: skill.id,
      category: skill.category,
      is_paid: skill.is_paid ? 1 : 0,
      avg_rating: skill.avg_rating,
      chunk_index: chunks[idx].index,
    } satisfies Record<string, string | number>,
  }));

  // Batch upsert (max 1000 vectors at a time)
  const batchSize = 1000;
  let totalUpserted = 0;

  for (let i = 0; i < vectors.length; i += batchSize) {
    const batch = vectors.slice(i, i + batchSize);
    await vectorize.upsert(batch);
    totalUpserted += batch.length;
  }

  return totalUpserted;
}
