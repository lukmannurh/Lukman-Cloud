import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', err => console.error('BROWSER RUNTIME EXCEPTION:', err.message));
  
  // Also capture network requests that fail
  page.on('response', response => {
    if (!response.ok()) {
      console.log(`[Network Error] ${response.status()} ${response.url()}`);
    }
  });

  const url = 'https://lukman-cloud.vercel.app/share/NzViYzc2M2YtODJmZS00OGYzLWE5NzYtZGYwMDdhNmQ2OGFm';
  console.log(`Navigating to ${url}...`);
  await page.goto(url, { waitUntil: 'networkidle' });

  console.log('Waiting for "Download File" button to become visible...');
  const btn = page.locator('button:has-text("Download File")');
  await btn.waitFor({ state: 'visible', timeout: 10000 });
  
  console.log('Clicking "Download File"...');
  await btn.click();
  
  console.log('Waiting for 5 seconds to capture logs...');
  await page.waitForTimeout(5000);

  console.log('Closing browser...');
  await browser.close();
})();
