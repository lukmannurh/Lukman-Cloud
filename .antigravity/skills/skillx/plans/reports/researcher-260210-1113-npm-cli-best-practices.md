# Research Report: npm CLI Tool Best Practices (2026)

**Date:** 2026-02-10
**Focus:** Building npx-compatible CLI with subcommands, API client, config management

---

## 1. Project Structure

Recommended directory layout:
```
skillx/
├── bin/
│   └── skillx.js           # Entry point with shebang
├── src/
│   ├── commands/
│   │   ├── search.js
│   │   ├── use.js
│   │   └── report.js
│   ├── lib/
│   │   └── api-client.js   # HTTP client for backend
│   └── utils/
│       └── config.js       # Config management
├── package.json
└── README.md
```

**Key practices:**
- Separate file per command (`src/commands/`)
- Core logic in `src/lib/`
- Entry point in `bin/` with shebang `#!/usr/bin/env node`
- Keep files under 200 lines when possible

**Sources:** [Node.js CLI Best Practices](https://github.com/lirantal/nodejs-cli-apps-best-practices), [Building CLI with Node.js](https://gomzkov.medium.com/building-a-cli-with-node-js-in-2024-c278802a3ef5)

---

## 2. CLI Framework Comparison

For **4-5 subcommands**, Commander.js is optimal:

| Framework | Bundle Size | Learning Curve | Best For |
|-----------|-------------|----------------|----------|
| **Commander.js** | Lightweight | Easy | Simple to moderate CLIs, git-style subcommands |
| Yargs | Medium | Moderate | Declarative syntax, complex arg parsing |
| oclif | Large (11.7kB+) | Steep | Enterprise apps, plugin architecture |
| Citty | N/A | N/A | No info found |

**Recommendation:** Commander.js
- 25M+ weekly downloads, de facto standard
- Clean subcommand API: `.command('search <query>').action(...)`
- Auto-generates help
- Minimal boilerplate for your use case

**Example:**
```js
#!/usr/bin/env node
const { program } = require('commander');

program
  .command('search <query>')
  .description('Search for skills')
  .action((query) => { /* ... */ });

program
  .command('use <skill>')
  .description('Install and activate skill')
  .action((skill) => { /* ... */ });

program.parse();
```

**Sources:** [Commander vs Others](https://npm-compare.com/commander,oclif,vorpal,yargs), [Commander Guide](https://betterstack.com/community/guides/scaling-nodejs/commander-explained/), [CLI Framework Comparison](https://www.oreateai.com/blog/indepth-comparison-of-cli-frameworks-technical-features-and-application-scenarios-of-yargs-commander-and-oclif/24440ae03bfbae6c4916c403a728f6da)

---

## 3. npx Compatibility

**Critical requirements:**

1. **Shebang:** Add `#!/usr/bin/env node` at top of entry file
2. **package.json bin field:**
   ```json
   {
     "name": "skillx",
     "version": "1.0.0",
     "bin": {
       "skillx": "./bin/skillx.js"
     }
   }
   ```
3. **File permissions:** Ensure entry file is executable (npm handles this automatically)

**How it works:**
- npx downloads/caches package
- Reads `bin` field from package.json
- Executes file with Node.js (shebang ensures cross-platform)
- npm creates `.bin` shims automatically on Windows

**Sources:** [Creating npx Command](https://deepgram.com/learn/npx-script), [NPM Package CLI](https://dev.to/nausaf/creating-an-npm-package-that-runs-on-command-line-with-npx-9a0), [Shebang Documentation](https://github.com/npm/feedback/discussions/148)

---

## 4. API Client Pattern

**Recommendation:** Use native `fetch` (Node.js v18+)

### Why fetch over axios?
- **Built-in:** No dependencies, zero bundle size
- **Modern:** Standard across Node.js v18+, Deno, Bun
- **Sufficient:** Your use case (API key auth, JSON requests) doesn't need axios features

### Implementation pattern:
```js
// src/lib/api-client.js
class SkillsAPIClient {
  constructor(apiKey, baseURL = 'https://api.example.com') {
    this.apiKey = apiKey;
    this.baseURL = baseURL;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async search(query) {
    return this.request('/skills/search', {
      method: 'POST',
      body: JSON.stringify({ query }),
    });
  }
}

module.exports = SkillsAPIClient;
```

**When to use axios:** Complex apps needing interceptors, automatic retries, request/response transformation.

**Sources:** [Fetch vs Axios 2026](https://iproyal.com/blog/axios-vs-fetch/), [HTTP Client Comparison](https://blog.logrocket.com/axios-vs-fetch-2025/), [Node.js API Auth](https://blog.logrocket.com/understanding-api-key-authentication-node-js/)

---

## 5. Config Management

### Recommended approach: `conf` package + XDG Base Directory

**Why conf:**
- Follows XDG Base Directory spec (`~/.config/skillx/`)
- Simple API for get/set
- Automatic JSON serialization
- Cross-platform support

**Installation:**
```bash
npm install conf
```

**Implementation:**
```js
// src/utils/config.js
const Conf = require('conf');

const config = new Conf({
  projectName: 'skillx',
  schema: {
    apiKey: {
      type: 'string',
      default: ''
    },
    baseURL: {
      type: 'string',
      default: 'https://api.skillx.dev'
    }
  }
});

module.exports = {
  getApiKey: () => config.get('apiKey'),
  setApiKey: (key) => config.set('apiKey', key),
  getConfig: () => config.store,
};
```

**Config location:**
- macOS: `~/Library/Preferences/skillx-nodejs/`
- Linux: `~/.config/skillx/`
- Windows: `%APPDATA%\skillx\Config`

**Environment variables fallback:**
```js
const apiKey = process.env.SKILLX_API_KEY || config.get('apiKey');
```

**Security:**
- Never commit API keys to git
- Use `.gitignore` for local `.env` files
- In production, use env vars or secrets management (Vault, AWS Secrets Manager)

**Sources:** [Config Management Best Practices](https://github.com/lirantal/nodejs-cli-apps-best-practices), [Secure Configuration](https://article.arunangshudas.com/best-practices-for-secure-configuration-management-in-node-js-de8833a748c6), [conf Package](https://www.npmjs.com/package/conf)

---

## 6. Output Formatting

**Minimum viable set for your CLI:**

| Library | Purpose | When to Use |
|---------|---------|-------------|
| **chalk** (5.x) | Text colors | Highlight keywords, errors, success |
| **ora** | Spinners | API requests, long operations |

**Optional (add if needed):**
- `cli-table3`: Tabular data (e.g., search results)
- `boxen`: Styled message boxes (warnings, updates)

**Example:**
```js
const chalk = require('chalk');
const ora = require('ora');

// Spinner for API calls
const spinner = ora('Searching skills...').start();
const results = await apiClient.search(query);
spinner.succeed(chalk.green('Found 5 skills'));

// Colored output
console.log(chalk.blue('Skill:'), chalk.bold(skill.name));
console.log(chalk.yellow('Description:'), skill.description);
```

**Best practices:**
- Don't rely solely on color (accessibility)
- Use async operations to avoid blocking spinner animations
- Combine libraries for polished UX (chalk + cli-table3 for colored tables)

**Sources:** [Polish CLI Output](https://egghead.io/lessons/javascript-polish-node-js-cli-output-with-chalk-and-ora), [CLI Best Practices](https://dev.to/boudydegeer/mastering-nodejs-cli-best-practices-and-tips-7j5), [Node.js CLI UX](https://nodesource.com/blog/node-js-powerful-beautiful-clis)

---

## 7. Distribution & Versioning

### npm Publish Workflow

**Manual approach:**
```bash
# 1. Update version
npm version patch   # or minor/major

# 2. Publish to npm
npm publish

# 3. Push git tags
git push && git push --tags
```

**Automated approach (recommended):** `semantic-release`
- Automates version bumping, changelog generation, npm publish
- Uses conventional commits (feat, fix, chore)
- Integrates with GitHub Actions/GitLab CI

**Setup:**
```bash
npm install --save-dev semantic-release
```

**GitHub Actions example:**
```yaml
name: Release
on:
  push:
    branches: [main]

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npx semantic-release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### Versioning Strategy

**Use Semantic Versioning (SemVer):**
- **Major (1.x.x):** Breaking changes
- **Minor (x.1.x):** New features, backward-compatible
- **Patch (x.x.1):** Bug fixes

**Pre-release labels:**
- `1.2.0-alpha.1`: Early testing
- `1.2.0-beta.1`: Feature-complete testing
- `1.2.0-rc.1`: Release candidate
- `1.2.0`: Stable release

**Sources:** [Semantic Versioning](https://docs.npmjs.com/about-semantic-versioning/), [semantic-release](https://www.npmjs.com/package/semantic-release), [npm Versioning Strategies](https://luisrangelc.medium.com/npm-versioning-strategies-81a2a9791553)

---

## Summary: Recommended Stack

```json
{
  "dependencies": {
    "commander": "^12.x",
    "conf": "^12.x",
    "chalk": "^5.x",
    "ora": "^8.x"
  },
  "devDependencies": {
    "semantic-release": "^23.x"
  }
}
```

**Project structure:**
```
bin/skillx.js          → Entry point with shebang
src/commands/*.js      → Subcommands (search, use, report)
src/lib/api-client.js  → fetch-based API client
src/utils/config.js    → conf for config management
```

**Key decisions:**
- **Framework:** Commander.js (simplest for 4-5 subcommands)
- **HTTP:** Native fetch (built-in, zero deps)
- **Config:** conf package (~/.config/skillx/)
- **Output:** chalk + ora (minimum viable)
- **Versioning:** semantic-release (automated)

---

## Unresolved Questions

1. **Backend API specification:** Need actual API endpoints, auth scheme (Bearer token?), response formats
2. **Error handling strategy:** Retry logic for failed API requests? Rate limiting?
3. **Skill installation mechanism:** How does `use` command actually install/activate skills? File system operations?
4. **Offline mode:** Should CLI work without API access? Local caching?
5. **Testing strategy:** Unit tests for commands, integration tests for API client?

---

**Report saved:** `/Users/duynguyen/www/claudekit/skillx/plans/reports/researcher-260210-1113-npm-cli-best-practices.md`
