/**
 * Scan a GitHub repo for SKILL.md files using the Tree API.
 * Returns discovered skills with their folder names and paths.
 * Uses a single recursive tree fetch — efficient (1 API call per scan).
 */

export interface DiscoveredSkill {
  /** Folder name, e.g. "ui-ux-pro-max" */
  skillName: string;
  /** Full path to skill folder, e.g. ".claude/skills/ui-ux-pro-max" */
  skillPath: string;
}

interface GitHubTreeEntry {
  path: string;
  mode: string;
  type: string;
  sha: string;
  size?: number;
}

interface GitHubTreeResponse {
  sha: string;
  tree: GitHubTreeEntry[];
  truncated: boolean;
}

interface GitHubRepoMeta {
  default_branch: string;
}

/**
 * Scan a GitHub repo for all SKILL.md files and return discovered skills.
 * @throws Error if repo not found, rate-limited, or API error.
 */
export async function scanGitHubRepo(
  owner: string,
  repo: string,
): Promise<DiscoveredSkill[]> {
  // Get default branch
  const repoRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}`,
    { headers: { Accept: "application/vnd.github.v3+json", "User-Agent": "SkillX/1.0" } },
  );

  if (repoRes.status === 404) {
    throw new Error(`GitHub repository ${owner}/${repo} not found`);
  }
  if (repoRes.status === 403) {
    throw new Error("GitHub API rate limit exceeded. Try again later.");
  }
  if (!repoRes.ok) {
    throw new Error(`GitHub API error: ${repoRes.status}`);
  }

  const repoMeta = (await repoRes.json()) as GitHubRepoMeta;

  // Fetch recursive tree
  const treeRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${repoMeta.default_branch}?recursive=1`,
    { headers: { Accept: "application/vnd.github.v3+json", "User-Agent": "SkillX/1.0" } },
  );

  if (!treeRes.ok) {
    throw new Error(`GitHub Tree API error: ${treeRes.status}`);
  }

  const treeData = (await treeRes.json()) as GitHubTreeResponse;

  if (treeData.truncated) {
    console.warn(`Warning: repo ${owner}/${repo} tree was truncated (very large repo). Some skills may be missed.`);
  }

  // Find all SKILL.md files (case-insensitive)
  const skillFiles = treeData.tree.filter(
    (entry) => entry.type === "blob" && entry.path.toLowerCase().endsWith("/skill.md"),
  );

  // Also check for root SKILL.md
  const rootSkillMd = treeData.tree.find(
    (entry) => entry.type === "blob" && entry.path.toLowerCase() === "skill.md",
  );

  const discovered: DiscoveredSkill[] = [];

  // Root SKILL.md → skill name = repo name
  if (rootSkillMd) {
    discovered.push({ skillName: repo, skillPath: "" });
  }

  // Nested SKILL.md files → skill name = parent folder name
  for (const entry of skillFiles) {
    const parentPath = entry.path.substring(0, entry.path.lastIndexOf("/"));
    const skillName = parentPath.includes("/")
      ? parentPath.substring(parentPath.lastIndexOf("/") + 1)
      : parentPath;

    discovered.push({ skillName, skillPath: parentPath });
  }

  return discovered;
}
