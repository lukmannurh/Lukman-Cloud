# Research Report: Cloudflare Vectorize + D1 for Semantic Search Platform

**Date:** 2026-02-10
**Focus:** Current capabilities, limits, pricing, best practices for semantic search + RAG
**Status:** Production-ready as of 2025-2026

---

## 1. Cloudflare Vectorize

### Capabilities (2026)

**Core Features:**
- Globally distributed vector database
- Median query latency: **30ms** (95% improvement from beta's 500ms)
- Support for semantic search, RAG, recommendations, classification, anomaly detection
- Native integration with Workers AI, R2, KV, D1
- Float32 precision (4 bytes/dimension)
- No charges for CPU, memory, inactive hours, or data transfer

**Vector Specifications:**
- **Max vectors per index:** 10M (up from 200K in beta — 50x increase)
- **Dimensions:** Up to 1,536 dimensions
- **Vector ID:** 64 bytes max
- **Metadata:** 10KB per vector
- **Metadata indexes:** 10 max per index (filterable properties)

**Namespaces:**
- **Paid plan:** 50,000 namespaces/index
- **Free plan:** 1,000 namespaces/index
- Namespace name: 64 bytes max

### Limits

| Constraint | Workers Paid | Free Tier |
|------------|--------------|-----------|
| Indexes per account | 50,000 | 100 |
| Vectors per index | 10M | 10M |
| Namespaces per index | 50,000 | 1,000 |
| topK (with values/metadata) | 20 | 20 |
| topK (without) | 100 | 100 |
| Upsert batch (Workers) | 1,000 | 1,000 |
| Upsert batch (HTTP API) | 5,000 | 5,000 |
| Vector upload size | 100 MB | 100 MB |

**Metadata Filtering:**
- Filter JSON: 2,048 bytes max
- String metadata indexed: First 64 bytes (UTF-8 truncated)
- Operators: `$eq`, `$ne`, `$in`, `$nin`, `$lt`, `$lte`, `$gt`, `$gte`
- Performance note: Range queries on ~10M+ vectors may reduce accuracy

### Pricing

**Formula:**
```
((queried_vectors + stored_vectors) × dimensions × $0.01/1M)
+ (stored_vectors × dimensions × $0.05/100M)
```

**Free Tier:**
- 30M queried dimensions/month
- 5M stored dimensions

**Paid Tier:**
- First 50M queried dimensions/month included → $0.01/million after
- First 10M stored dimensions included → $0.05/100M after

**Examples (768-dim vectors):**

| Vectors Stored | Queries/Month | Monthly Cost |
|----------------|---------------|--------------|
| 5,000 | 10,000 | Free |
| 25,000 | 50,000 | $0.59 |
| 50,000 | 200,000 | $1.94 |
| 250,000 | 500,000 | $5.86 |
| 500,000 (1536-dim) | 1M | $23.42 |

### Query Performance

**Benchmarks:**
- Median latency: **30ms** (warm cache)
- Test conditions: 300 concurrent requests via Worker binding
- Datasets: 1M vectors @ 1536-dim; 5M vectors @ 768-dim
- Similarity: Cosine, topK=10

**Performance characteristics:**
- Metadata filtering can **speed up queries** (prunes search space)
- O(log n) complexity for metadata lookups
- Optimized for sustained usage (network + RAM caching)

---

## 2. Cloudflare D1

### Capabilities

**Core Features:**
- Serverless SQLite database
- Full SQLite compatibility
- Built-in FTS5 (full-text search) support
- No billing for idle time (usage-based only)
- No data transfer charges
- Up to 6 concurrent connections per Worker

**SQLite Version:**
- Native SQLite semantics
- Virtual tables supported (FTS5, fts5vocab)
- Standard SQL statements

### Limits

| Constraint | Paid Plan | Free Plan |
|------------|-----------|-----------|
| Database size | **10 GB** (cannot increase) | 500 MB |
| Total storage/account | 1 TB | 5 GB |
| Max columns/table | 100 | 100 |
| Query duration | 30 seconds | 30 seconds |
| SQL statement length | 100 KB | 100 KB |
| Bound parameters | 100/query | 100/query |
| Queries/Worker invocation | 1,000 | 50 |

**Critical Constraints:**
- **Single-threaded:** Processes queries one at a time
- **Throughput:** ~1,000 queries/sec @ 1ms queries; ~10 queries/sec @ 100ms queries
- **Batching required:** Large UPDATE/DELETE on millions of rows must be chunked (1,000 rows recommended)
- **Insert batching:** Max 10 rows/insert with 10 columns (100 bound params limit)

### Pricing

**Free Tier (daily limits):**
- 5M rows read/day
- 100K rows written/day
- 5 GB storage

**Paid Tier (monthly):**
- First 25B rows read included → $0.001/million after
- First 50M rows written included → $1.00/million after
- First 5 GB storage included → $0.75/GB-month after

**Billing Notes:**
- No compute charges when idle
- Rows read = ALL scanned rows (inefficient queries cost more)
- Empty DB: ~12 KB; empty table: few KB based on columns
- Free limits reset daily; paid resets on subscription date

---

## 3. Workers AI Embedding Models

### Available Models (On Workers AI)

| Model | Dimensions | Rate Limit | Notes |
|-------|------------|------------|-------|
| @cf/baai/bge-small-en-v1.5 | 384 | 3000 req/min | Best for speed |
| @cf/baai/bge-base-en-v1.5 | 768 | 3000 req/min | Balanced |
| @cf/baai/bge-large-en-v1.5 | 1024 | **1500 req/min** | Best accuracy |
| @cf/baai/bge-m3 | Varies | 3000 req/min | Multilingual |
| @google/embeddinggemma-300m | Varies | 3000 req/min | 100+ languages |
| @qwen/qwen3-embedding-0.6b | Varies | 3000 req/min | Latest Qwen |
| @pfnet/plamo-embedding-1b | Varies | 3000 req/min | Japanese-specific |

**Pooling Options (BGE models):**
- `mean` (default) — faster
- `cls` — more accurate on larger inputs
- **Not compatible:** Embeddings from different pooling methods can't be compared

**Batch API:**
- Send array of requests for large workloads
- Eventual fulfillment guarantee (no capacity errors)
- Local mode (Wrangler) counts toward rate limits

### External APIs (Alternative)

If Workers AI rate limits or model selection insufficient:
- OpenAI: text-embedding-3-small (1536-dim), text-embedding-3-large (3072-dim → need dimension reduction)
- Cohere: embed-english-v3.0 (1024-dim), embed-multilingual-v3.0 (1024-dim)
- **Trade-off:** External APIs = cost + latency vs. Workers AI = free tier + 3000 req/min

---

## 4. Best Practices: D1 + Vectorize for RAG/Semantic Search

### Hybrid Search Architecture

**Recommended Pattern:**

```
User Query
    ↓
┌───────────────────────────────────┐
│  1. Dual Retrieval (Parallel)    │
├───────────────────────────────────┤
│  • D1: FTS5 BM25 (keyword match) │
│  • Vectorize: Semantic search    │
└───────────────────────────────────┘
    ↓
┌───────────────────────────────────┐
│  2. Reciprocal Rank Fusion (RRF) │
│     Merge by rank position        │
└───────────────────────────────────┘
    ↓
┌───────────────────────────────────┐
│  3. AI Reranker (LLM relevance)  │
│     Final relevance assessment    │
└───────────────────────────────────┘
    ↓
┌───────────────────────────────────┐
│  4. Retrieve Full Objects         │
│     From D1/R2/KV via IDs         │
└───────────────────────────────────┘
    ↓
   LLM Generation (RAG)
```

**Why Hybrid?**
- **Vector search:** Captures semantic similarity, paraphrases, concepts
- **FTS5 BM25:** Exact keywords, proper nouns, technical terms
- **Together:** Covers both semantic + lexical recall

### Data Organization Patterns

**Pattern A: D1 Primary + Vectorize References**
- Store full content in D1 (text chunks, metadata)
- Store embeddings + minimal metadata in Vectorize
- Vector metadata includes: `{chunk_id, doc_id, namespace}`
- Query flow: Vectorize → retrieve IDs → D1 batch fetch

**Pattern B: Distributed Storage**
- D1: Structured metadata, user profiles, small text
- R2: Large documents, images
- Vectorize: Embeddings + references `{storage_type, object_id}`

**Pattern C: Namespace Segmentation**
- Use Vectorize namespaces for tenant isolation (multi-tenant apps)
- Each namespace = separate user/org/category
- D1 stores namespace mapping + permissions

### FTS5 Integration (D1)

**Setup:**
```sql
CREATE VIRTUAL TABLE chunks_fts USING fts5(content, content=chunks, content_rowid=id);

-- Keep FTS in sync with triggers
CREATE TRIGGER chunks_ai AFTER INSERT ON chunks BEGIN
  INSERT INTO chunks_fts(rowid, content) VALUES (new.id, new.content);
END;

CREATE TRIGGER chunks_ad AFTER DELETE ON chunks BEGIN
  DELETE FROM chunks_fts WHERE rowid = old.id;
END;

CREATE TRIGGER chunks_au AFTER UPDATE ON chunks BEGIN
  UPDATE chunks_fts SET content = new.content WHERE rowid = new.id;
END;
```

**Query:**
```sql
SELECT id, bm25(chunks_fts) AS score
FROM chunks_fts
WHERE chunks_fts MATCH 'query terms'
ORDER BY score
LIMIT 20;
```

### Metadata Strategy (Vectorize)

**Create indexes BEFORE inserting vectors:**
```javascript
// Index filterable properties
await vectorize.createMetadataIndex("doc_type", "string");
await vectorize.createMetadataIndex("created_at", "number");
await vectorize.createMetadataIndex("user_id", "string");
```

**Query with filters:**
```javascript
const results = await vectorize.query(embedding, {
  topK: 10,
  filter: {
    doc_type: "article",
    created_at: { $gte: 1704067200 }, // 2024-01-01
    user_id: { $in: ["user123", "user456"] }
  },
  returnMetadata: "all"
});
```

**Optimization:**
- Metadata filtering **prunes search space** → often faster than unfiltered
- Limit metadata indexes to frequently filtered properties (10 max)
- Keep filter JSON < 2KB

### Data Chunking

**Chunk size considerations:**
- **Smaller chunks (128-256 tokens):** Better precision, more vectors, higher cost
- **Larger chunks (512-1024 tokens):** Better context, fewer vectors, lower cost
- **Overlap:** 10-20% overlap between chunks improves boundary recall

**Example:**
- 100,000 docs × 4 chunks/doc × 768-dim = 307M stored dimensions = **$1.54/month storage**
- 10,000 queries/day × 4 retrieved chunks × 768-dim = 922M queried dimensions/month = **$8.72/month queries**
- **Total:** ~$10.26/month (including free tier credits)

### Query Optimization (D1)

**Index strategy:**
```sql
CREATE INDEX idx_doc_created ON documents(created_at);
CREATE INDEX idx_chunk_doc ON chunks(doc_id);
```

**Efficient queries:**
- Aim for `rows_returned / rows_read → 1.0`
- Use `EXPLAIN QUERY PLAN` to verify index usage
- Batch operations: 1,000 rows/statement max
- Avoid cartesian products (split complex joins)

**Throughput:**
- Optimize query duration (1ms query = 1K QPS; 100ms query = 10 QPS)
- Use appropriate indexes (read queries < 1ms)
- Writes take several ms

### RAG Pipeline Steps

**1. Ingestion:**
- Chunk documents (overlap: 10-20%)
- Generate embeddings via Workers AI batch API
- Insert to D1 (content + metadata) + Vectorize (vectors + refs)

**2. Query Processing:**
- Embed user query (Workers AI)
- Parallel retrieval:
  - Vectorize: `query()` → top 20 semantic matches
  - D1 FTS5: BM25 → top 20 keyword matches
- RRF merge: Combine by rank position
- (Optional) Rerank via LLM for final top 5-10

**3. Context Assembly:**
- Fetch full content from D1/R2 using retrieved IDs
- Format for LLM context window
- Include metadata (source, date, etc.)

**4. Generation:**
- Send context + query to LLM (Workers AI or external)
- Stream response to user

---

## 5. Production Gotchas & Known Issues

### Vectorize Issues

❌ **No local simulation**
- Must connect to production indexes for dev/testing
- Workaround: Use separate dev index with `remote: true` in wrangler.toml

❌ **Large-scale insert performance**
- Community reports slow inserts at scale (April 2025)
- Recommendation: Batch upserts (1K vectors via Workers, 5K via HTTP API)
- Use async patterns for large ingestion jobs

❌ **Limited metadata filtering**
- No full-text search on metadata (only exact/range comparisons)
- For FTS on metadata → use D1 instead

❌ **topK limits**
- topK=20 max when `returnMetadata: "all"` or `returnValues: true`
- topK=100 max otherwise
- For larger result sets → multiple queries with namespace/metadata partitioning

❌ **Range query accuracy degradation**
- At ~10M+ vectors, range filters may reduce accuracy
- Mitigation: Use equality filters where possible

### D1 Issues

❌ **10 GB hard limit**
- Cannot increase per-database size
- Solution: Horizontal scaling across multiple databases
  - Workers Paid: Request higher DB count via support
  - Design for sharding from start (by user, date, category)

❌ **Single-threaded processing**
- One query at a time per DB
- Peak throughput tied to query speed
- Solution: Multiple databases for read scaling

❌ **Bound parameter limit**
- Max 100 params/query
- Impacts batch inserts: 10 rows × 10 columns = 100 params
- Solution: Loop smaller batches

❌ **Large mutations must be chunked**
- UPDATE/DELETE on millions of rows → timeout
- Solution: Process in 1K row batches

❌ **Cartesian product explosions**
- Complex JOINs can multiply rows unexpectedly
- Solution: Split queries, handle aggregation in code

❌ **Inefficient queries cost more**
- Billing on rows *read*, not returned
- `rows_read / rows_returned` should → 1.0
- Missing indexes = full table scans = high cost

### Workers AI Issues

❌ **Rate limits per model**
- bge-large: **1500 req/min** (others: 3000)
- Solution: Use batch API for bulk work, queue requests

❌ **Pooling incompatibility**
- `mean` vs `cls` embeddings not comparable
- Solution: Pick one pooling method, never mix

❌ **Local dev counts toward limits**
- Wrangler local mode = production quota usage
- Solution: Mock embeddings for unit tests, use dev index for integration tests

### Integration Gotchas

❌ **Clock skew in distributed systems**
- Workers edge execution + D1 replication = eventual consistency
- Solution: Use timestamps from single source (D1 auto), avoid client-side timestamps

❌ **Worker invocation limits**
- Free: 50 D1 queries/invocation
- Paid: 1,000 D1 queries/invocation
- Solution: Batch D1 operations, use D1 batch API

❌ **No transactions across D1 + Vectorize**
- Cannot atomically update both
- Solution: D1 as source of truth, async Vectorize updates, handle inconsistency

---

## 6. Architecture Recommendations

### Small-Scale App (<100K vectors, <1GB data)

**Stack:**
- Single D1 database
- Single Vectorize index
- Workers AI: bge-base-en-v1.5 (768-dim, 3K req/min)
- FTS5 in D1 for keyword search

**Costs:** ~$0-5/month (mostly free tier)

### Medium-Scale App (100K-1M vectors, 1-5GB data)

**Stack:**
- 1-2 D1 databases (shard by tenant/category)
- 1-2 Vectorize indexes (same sharding)
- Workers AI: bge-large-en-v1.5 (1024-dim) or external API
- Hybrid search: FTS5 + Vectorize + RRF

**Costs:** $10-50/month

### Large-Scale App (1M-10M vectors, 5-10GB data)

**Stack:**
- Multiple D1 databases (shard by user range, time buckets)
- Multiple Vectorize indexes (align shards)
- External embedding API (OpenAI/Cohere) for higher throughput
- AI Gateway for rate limiting + caching
- R2 for document storage
- Namespace isolation per tenant

**Costs:** $50-500/month (depending on query volume)

### Performance Checklist

✅ **D1:**
- Create indexes on all WHERE/JOIN columns
- Use `EXPLAIN QUERY PLAN` before deploying queries
- Batch writes in 1K chunks
- Monitor `rows_read` vs `rows_returned` ratio
- Shard before hitting 8GB (leave headroom)

✅ **Vectorize:**
- Create metadata indexes BEFORE bulk insert
- Use namespaces for tenant isolation
- Batch upserts (1K vectors)
- Enable metadata filtering to speed queries
- Monitor query latency via metrics

✅ **Workers AI:**
- Use batch API for embedding generation
- Implement exponential backoff for rate limits
- Cache embeddings in KV for repeated queries
- Consider external API if >3K req/min sustained

---

## 7. Unresolved Questions

1. **Vectorize replication lag:** What's the typical propagation time for vector upserts across Cloudflare's edge? Does it affect real-time search?

2. **D1 read replicas:** Any plans for read replicas to scale single-threaded constraint?

3. **Workers AI batch API specifics:** What's the max batch size and timeout for embedding batch requests?

4. **Cross-region consistency:** How does D1 handle writes from different edge locations? Conflict resolution strategy?

5. **Vectorize index rebuild:** If metadata index created after vectors exist, is full rebuild required? Performance impact?

6. **AI Gateway integration:** Can AI Gateway cache embeddings to reduce Workers AI rate limit pressure? Cost implications?

---

## Sources

- [Vectorize Pricing](https://developers.cloudflare.com/vectorize/platform/pricing/)
- [Vectorize Limits](https://developers.cloudflare.com/vectorize/platform/limits/)
- [Vectorize Overview](https://developers.cloudflare.com/vectorize/)
- [Building Vectorize Blog](https://blog.cloudflare.com/building-vectorize-a-distributed-vector-database-on-cloudflare-developer-platform/)
- [D1 Overview](https://developers.cloudflare.com/d1/)
- [D1 Limits](https://developers.cloudflare.com/d1/platform/limits/)
- [D1 Pricing](https://developers.cloudflare.com/d1/platform/pricing/)
- [Workers AI Models](https://developers.cloudflare.com/workers-ai/models/)
- [Workers AI Limits](https://developers.cloudflare.com/workers-ai/platform/limits/)
- [Build RAG Tutorial](https://developers.cloudflare.com/workers-ai/guides/tutorials/build-a-retrieval-augmented-generation-ai/)
- [Vectorize Metadata Filtering](https://developers.cloudflare.com/vectorize/reference/metadata-filtering/)
- [Contextual RAG on Cloudflare](https://boristane.com/blog/cloudflare-contextual-rag/)
- [D1 FAQ](https://developers.cloudflare.com/d1/reference/faq/)
- [Workers AI Changelog](https://developers.cloudflare.com/changelog/2025-04-11-new-models-faster-inference/)
