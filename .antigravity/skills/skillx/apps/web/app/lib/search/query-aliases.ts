/**
 * Query alias map for common abbreviations in skill search.
 * Expands FTS5 queries so abbreviations match full terms.
 * Vector search handles semantic similarity; this covers lexical gaps in FTS5.
 */

const ALIASES: Record<string, string> = {
  k8s: 'kubernetes',
  ts: 'typescript',
  js: 'javascript',
  py: 'python',
  rb: 'ruby',
  tf: 'terraform',
  gh: 'github',
  cf: 'cloudflare',
  aws: 'amazon',
  gcp: 'google cloud',
  db: 'database',
  cli: 'command line terminal',
  ci: 'continuous integration',
  cd: 'continuous deployment',
  ml: 'machine learning',
  ai: 'artificial intelligence',
  llm: 'language model',
  rag: 'retrieval augmented generation',
  mcp: 'model context protocol',
  ux: 'user experience',
  ui: 'user interface',
  auth: 'authentication authorization',
  deps: 'dependencies',
  env: 'environment',
  config: 'configuration',
  infra: 'infrastructure',
  devops: 'deployment operations',
  docker: 'container',
  react: 'reactjs',
  vue: 'vuejs',
  next: 'nextjs',
  node: 'nodejs',
};

/** Expand query terms using alias map.
 *  Returns original query with alias expansions OR-joined.
 *  Example: "k8s deploy" → "(kubernetes OR k8s) deploy" */
export function expandAliases(query: string): string {
  const terms = query.split(/\s+/).filter(Boolean);

  const expanded = terms.map((term) => {
    const lower = term.toLowerCase();
    const alias = ALIASES[lower];
    if (alias) {
      const aliasTerms = alias.split(/\s+/);
      const allTerms = [lower, ...aliasTerms];
      return `(${allTerms.join(' OR ')})`;
    }
    return term;
  });

  return expanded.join(' ');
}
