import { apiRequest } from './api-client.js';

export interface SearchResult {
  slug: string;
  name: string;
  author: string;
  category: string;
  avg_rating: number | null;
  description: string;
}

interface SearchResponse {
  results: SearchResult[];
  count: number;
}

/** Search the SkillX API and return results */
export async function searchSkills(query: string): Promise<SearchResult[]> {
  const response = await apiRequest<SearchResponse>('/api/search', {
    method: 'POST',
    body: JSON.stringify({ query }),
  });
  return response.results || [];
}
