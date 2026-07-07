/**
 * Vitest global test setup for Lukman Cloud.
 *
 * This file is referenced in vite.config.ts → test.setupFiles.
 * It runs once before each test file.
 */
import '@vitest/coverage-v8';

// ── SubtleCrypto polyfill for JSDOM environment ───────────────────────────────
// JSDOM does not implement window.crypto.subtle. We use Node.js's built-in
// WebCrypto implementation (available in Node 18+) as a drop-in replacement.
// @ts-ignore
import { webcrypto } from 'node:crypto';

// Make SubtleCrypto available globally in the test environment
if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    writable: false,
  });
}

// ── BroadcastChannel polyfill (not available in JSDOM) ───────────────────────
// Use a simple in-memory implementation for unit tests.
// This ensures BroadcastChannel-dependent code can be unit tested.
class MockBroadcastChannel extends EventTarget {
  readonly name: string;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onmessageerror: ((event: MessageEvent) => void) | null = null;

  private static channels: Map<string, MockBroadcastChannel[]> = new Map();

  constructor(name: string) {
    super();
    this.name = name;
    if (!MockBroadcastChannel.channels.has(name)) {
      MockBroadcastChannel.channels.set(name, []);
    }
    MockBroadcastChannel.channels.get(name)!.push(this);
  }

  postMessage(message: unknown): void {
    const channels = MockBroadcastChannel.channels.get(this.name) ?? [];
    for (const channel of channels) {
      if (channel !== this) {
        const event = new MessageEvent('message', { data: message });
        channel.dispatchEvent(event);
        channel.onmessage?.(event);
      }
    }
  }

  close(): void {
    const channels = MockBroadcastChannel.channels.get(this.name) ?? [];
    const index = channels.indexOf(this);
    if (index !== -1) channels.splice(index, 1);
  }

  static __reset(): void {
    MockBroadcastChannel.channels.clear();
  }
}

if (typeof BroadcastChannel === 'undefined') {
  Object.defineProperty(globalThis, 'BroadcastChannel', {
    value: MockBroadcastChannel,
    writable: false,
  });
}
