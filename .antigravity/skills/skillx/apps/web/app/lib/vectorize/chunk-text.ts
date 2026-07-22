interface Chunk {
  text: string;
  index: number;
}

/**
 * Chunks text into overlapping segments for embedding.
 *
 * @param text - The text to chunk
 * @param maxTokens - Maximum tokens per chunk (default 512)
 * @param overlapPercent - Percentage overlap between chunks (default 0.1)
 * @returns Array of text chunks with indices
 */
export function chunkText(text: string, maxTokens = 512, overlapPercent = 0.1): Chunk[] {
  const maxChars = maxTokens * 4; // ~1 token ≈ 4 chars
  const overlapChars = Math.floor(maxChars * overlapPercent);
  const chunks: Chunk[] = [];
  let start = 0;
  let index = 0;

  while (start < text.length) {
    const end = Math.min(start + maxChars, text.length);
    chunks.push({ text: text.slice(start, end), index });
    start = end - overlapChars;
    index++;
    if (end === text.length) break;
  }

  return chunks;
}
