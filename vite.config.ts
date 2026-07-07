// @ts-nocheck
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─────────────────────────────────────────────────────────────────────────────
// Lukman Cloud — Vite Build Configuration
//
// PHASE 0 LOCK-IN NOTES:
//
// 1. vite-plugin-node-polyfills({ include: ['buffer'] }):
//    GramJS (telegram npm package) internally calls `Buffer.from()` and other
//    Node.js Buffer APIs. Vite's browser build does NOT provide these globals.
//    This polyfill MUST be present in BOTH the main build plugins AND the worker
//    plugins — GramJS runs inside a Web Worker and needs Buffer there too.
//
// 2. manualChunks gramjs:
//    The GramJS bundle is ~600-900KB gzipped. It MUST be in a separate lazy
//    chunk and NEVER statically imported at module top-level. The TelegramWorker
//    loads it via dynamic import() inside the worker context.
//
// 3. worker.format: 'es':
//    Required for Web Workers to use ES module dynamic imports (GramJS lazy load).
// ─────────────────────────────────────────────────────────────────────────────

const nodePolyfillsConfig = nodePolyfills({
  // Only polyfill Buffer — do NOT polyfill the entire Node.js stdlib
  include: ['buffer'],
  globals: {
    Buffer: true,
    // GramJS also references `global` in some paths
    global: true,
    process: false,
  },
});

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // MANDATORY: Must run BEFORE react() processes JSX to ensure Buffer is
    // available in all module scopes
    nodePolyfillsConfig,
  ],

  resolve: {
    alias: [
      // os shim: GramJS calls os.release() which has no browser equivalent.
      { find: 'os', replacement: path.resolve(__dirname, './src/workers/os-shim.ts') },
      // crypto shim: synchronous randomBytes + createHash (SHA-1/SHA-256) in pure JS.
      // Regex exact-match prevents accidentally intercepting 'crypto-browserify' etc.
      // cryptoShim.default = cryptoShim (self-reference) defeats CryptoFile_1.default proxy traps.
      { find: /^crypto$/, replacement: path.resolve(__dirname, './src/workers/crypto-shim.ts') },
      // FORCE GRAMJS TO USE BROWSER WEBSOCKETS INSTEAD OF NODE TCP
      { find: 'telegram/extensions/PromisedNetSockets', replacement: 'telegram/extensions/PromisedWebSockets' },
    ],
  },

  server: {
    watch: {
      ignored: ['**/session/**', '**/*.session', '**/telegram-session*', '**/.session/**']
    }
  },

  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: {
          // GramJS lazy chunk — loaded only when Telegram auth is triggered
          // DO NOT add 'crypto-js' here — we use browser-native SubtleCrypto ONLY
          gramjs: ['telegram'],
          // React vendor chunk — cached separately from app code
          'react-vendor': ['react', 'react-dom'],
        },
      },
    },
  },

  worker: {
    // ES module format required for dynamic imports inside workers
    format: 'es',
    // CRITICAL: Apply the same Buffer polyfill inside Web Worker context
    // Without this, GramJS WILL fail inside the TelegramWorker
    plugins: () => [
      nodePolyfills({
        include: ['buffer'],
        globals: { Buffer: true, global: true, process: false },
      }),
    ],
  },

  optimizeDeps: {
    // Exclude telegram to prevent pre-bundler from stripping compiler module aliases
    include: ['telegram'],
    esbuildOptions: {
      // GramJS references `global` in some internal paths
      define: {
        global: 'globalThis',
      },
      plugins: [
        {
          name: 'esbuild-worker-alias-fix',
          setup(build) {
            build.onResolve({ filter: /^os$/ }, () => ({
              path: path.resolve(__dirname, './src/workers/os-shim.ts'),
            }));
            // crypto shim: provides sync randomBytes + createHash for GramJS CryptoFile.js
            build.onResolve({ filter: /^crypto$/ }, () => ({
              path: path.resolve(__dirname, './src/workers/crypto-shim.ts'),
            }));
            // Broad filter — catches both absolute and relative internal GramJS imports
            // e.g. 'telegram/extensions/PromisedNetSockets' AND '../../extensions/PromisedNetSockets'
            build.onResolve({ filter: /PromisedNetSockets/ }, () => ({
              path: path.resolve(__dirname, 'node_modules/telegram/extensions/PromisedWebSockets.js'),
            }));
          },
        },
      ],
    },
  },

  test: {
    // Vitest configuration (inline)
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/lib/**', 'src/components/**'],
      exclude: ['src/workers/**', 'src/test/**'],
    },
  },
} as any);
