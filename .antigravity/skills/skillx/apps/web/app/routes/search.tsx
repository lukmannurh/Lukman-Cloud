import { useState } from "react";
import { useSearchParams } from "react-router";
import type { Route } from "./+types/search";
import { PageContainer } from "../components/layout/page-container";
import { SearchInput } from "../components/search-input";
import { FilterTabs } from "../components/filter-tabs";
import { SkillCard } from "../components/skill-card";
import { getDb } from "~/lib/db";
import { skills } from "~/lib/db/schema";
import { inArray } from "drizzle-orm";
import { hybridSearch } from "~/lib/search/hybrid-search";
import { fts5Search } from "~/lib/search/fts5-search";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const url = new URL(request.url);
  const query = url.searchParams.get("q") || "";
  const category = url.searchParams.get("category") || undefined;

  if (!query) {
    return { results: [], query: "" };
  }

  const db = getDb(env.DB);
  let results;

  try {
    // Try hybrid search first
    results = await hybridSearch(
      db,
      env.DB,
      env.VECTORIZE,
      env.AI,
      query,
      { category },
      undefined,
      20
    );
  } catch (error) {
    console.error("Hybrid search failed, falling back to FTS5:", error);
    // Fallback to FTS5 only
    try {
      const fts = await fts5Search(env.DB, query, 20);
      const ids = fts.map((r) => r.skill_id);
      if (ids.length > 0) {
        results = await db
          .select()
          .from(skills)
          .where(inArray(skills.id, ids));
      } else {
        results = [];
      }
    } catch (ftsError) {
      console.error("FTS5 search also failed:", ftsError);
      results = [];
    }
  }

  return { results, query };
}

export default function Search({ loaderData }: Route.ComponentProps) {
  const { results, query } = loaderData;
  const [activeTab, setActiveTab] = useState("all");

  return (
    <PageContainer>
      <div className="mb-8">
        <h1 className="mb-6 text-center font-mono text-3xl font-bold">
          Find Your Perfect Skill
        </h1>
        <SearchInput defaultValue={query} />
      </div>

      <div className="mb-6">
        <FilterTabs activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      {/* Results Grid */}
      {query ? (
        results.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {results.map((skill) => (
              <SkillCard
                key={skill.slug}
                slug={skill.slug}
                name={skill.name}
                author={skill.author}
                description={skill.description}
                category={skill.category}
                installs={skill.install_count || 0}
                rating={skill.avg_rating || 0}
              />
            ))}
          </div>
        ) : (
          <div className="py-16 text-center">
            <p className="text-sx-fg-muted">
              No skills found. Try a different query.
            </p>
          </div>
        )
      ) : (
        <div className="py-16 text-center">
          <p className="text-sx-fg-muted">Enter a search query to find skills.</p>
        </div>
      )}
    </PageContainer>
  );
}
