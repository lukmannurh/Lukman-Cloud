import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

// ── Compatibility Gate ───────────────────────────────────────────────────────
// Verify required Web APIs are available before mounting the React app.
// Fail fast with a clear error rather than a cryptic crash deep in crypto code.
const requiredAPIs: Array<{ name: string; check: () => boolean }> = [
  { name: 'SubtleCrypto (Web Crypto API)', check: () => typeof crypto?.subtle?.encrypt === 'function' },
  { name: 'IndexedDB', check: () => typeof indexedDB !== 'undefined' },
  { name: 'BroadcastChannel', check: () => typeof BroadcastChannel !== 'undefined' },
  { name: 'Web Workers', check: () => typeof Worker !== 'undefined' },
];

const missing = requiredAPIs.filter(({ check }) => !check()).map(({ name }) => name);

if (missing.length > 0) {
  document.getElementById('root')!.innerHTML = `
    <div style="
      font-family: monospace;
      padding: 2rem;
      border: 3px solid #0D0D0D;
      box-shadow: 5px 5px 0 #0D0D0D;
      max-width: 480px;
      margin: 4rem auto;
      background: #FAFAFA;
    ">
      <h1 style="margin-top:0; font-size:1.25rem;">⚠️ Browser Compatibility Error</h1>
      <p>Lukman Cloud requires modern browser APIs that are not available in your browser:</p>
      <ul>
        ${missing.map((name) => `<li><strong>${name}</strong></li>`).join('')}
      </ul>
      <p>Please use a modern browser such as Chrome 90+, Firefox 90+, or Edge 90+ over HTTPS.</p>
    </div>
  `;
  throw new Error(`[LukmanCloud] Missing required APIs: ${missing.join(', ')}`);
}

// ── Mount React App ──────────────────────────────────────────────────────────
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('[LukmanCloud] #root element not found in index.html');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
