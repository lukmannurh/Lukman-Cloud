# Phase 2: CLI Device ID + Install Tracking

## Context

- [Phase 1](./phase-01-schema-and-api.md) must be complete (API endpoint exists)
- CLI config store: `packages/cli/src/utils/config-store.ts` (20 lines)
- CLI use command: `packages/cli/src/commands/use.ts` (79 lines)
- CLI api-client: `packages/cli/src/lib/api-client.ts` (35 lines)

## Overview

- **Priority:** P2
- **Status:** complete
- **Effort:** XS
- Add `getDeviceId()` to config-store, fire-and-forget install POST in use command

## Related Code Files

### Modify
- `packages/cli/src/utils/config-store.ts` -- add `getDeviceId()`
- `packages/cli/src/commands/use.ts` -- add fire-and-forget install POST

## Implementation Steps

### 1. Add `getDeviceId()` to config-store.ts

After `setBaseUrl()` (line 19), add:

```typescript
import { randomUUID } from 'node:crypto';

export function getDeviceId(): string {
  let deviceId = config.get('deviceId') as string | undefined;
  if (!deviceId) {
    deviceId = randomUUID();
    config.set('deviceId', deviceId);
  }
  return deviceId;
}
```

**Note:** `randomUUID` is available in Node 19+. CLI targets modern Node. Import at top of file.

### 2. Update use.ts -- fire-and-forget install POST

After `spinner.stop()` (line 25) and before the display logic, add fire-and-forget:

```typescript
import { getApiKey, getBaseUrl, getDeviceId } from '../utils/config-store.js';
```

Then after `spinner.stop()`:

```typescript
// Fire-and-forget install tracking (silent failure)
const installHeaders: Record<string, string> = {
  'Content-Type': 'application/json',
  'X-Device-Id': getDeviceId(),
};
const apiKey = getApiKey();
if (apiKey) {
  installHeaders['Authorization'] = `Bearer ${apiKey}`;
}
fetch(`${getBaseUrl()}/api/skills/${slug}/install`, {
  method: 'POST',
  headers: installHeaders,
}).catch(() => {}); // Silent failure -- don't block UX
```

**Key decisions:**
- Use raw `fetch`, NOT `apiRequest` -- `apiRequest` throws on error which would surface to user
- `.catch(() => {})` -- swallow all errors (network failures, 4xx, 5xx)
- No `await` -- fire-and-forget, doesn't block command output
- Always send `X-Device-Id` even when API key is present (server uses user_id for dedup when available)
- Place after `spinner.stop()` but before display so the request fires early

### 3. Import updates for use.ts

Current import (line 4):
```typescript
import { apiRequest, ApiError } from '../lib/api-client.js';
```

Add alongside existing imports:
```typescript
import { getApiKey, getBaseUrl, getDeviceId } from '../utils/config-store.js';
```

## Todo List

- [x] Add `randomUUID` import to config-store.ts
- [x] Add `getDeviceId()` function to config-store.ts
- [x] Add config-store imports to use.ts
- [x] Add fire-and-forget POST after spinner.stop() in use.ts
- [x] Verify both files stay under 200 LOC

## Success Criteria

- `getDeviceId()` returns consistent UUID across calls (persisted in `~/.config/skillx/config.json`)
- `skillx use <slug>` fires POST to `/api/skills/:slug/install` without blocking output
- Failed POST does not produce any console output or exit code changes
- Works with and without API key configured

## Risk Assessment

- **Node.js `fetch` availability:** Global `fetch` is available since Node 18. CLI targets modern Node -- no polyfill needed.
- **Process exit before request completes:** Fire-and-forget may not complete if process exits immediately. This is acceptable -- installs are approximate. For the `--raw` path which returns early, the request may not complete, but that is an acceptable trade-off.
