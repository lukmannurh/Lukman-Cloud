import { chromium } from 'playwright-core';
import fs from 'fs';

(async () => {
  console.log('Starting Playwright...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('requestfailed', request =>
    console.log(`[NETWORK FAILED]: ${request.url()} - ${request.failure()?.errorText}`)
  );
  
  page.on('response', response => {
    if (response.url().includes('/api/auth')) {
      console.log(`[AUTH NETWORK]: ${response.status()} ${response.url()}`);
    }
  });

  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`[BROWSER ERROR]: ${msg.text()}`);
    }
  });

  console.log('Navigating to live production site...');
  await page.goto('https://lukman-cloud.vercel.app/', { waitUntil: 'networkidle' });
  
  console.log('Page title:', await page.title());

  try {
    console.log('Attempting to click Google Sign In...');
    // We try to trigger the Google login popup which internally fetches /api/auth/sign-in/social
    await page.click('text=Continue with Google', { timeout: 5000 });
    console.log('Clicked Google button. Waiting 5 seconds to observe network...');
    await page.waitForTimeout(5000);
  } catch(e) {
    console.log('Could not find Google button:', e.message);
  }
  
  await browser.close();
  console.log('Done.');
})();
