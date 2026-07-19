import { chromium, devices } from 'playwright-core';
import fs from 'fs';

(async () => {
  console.log("[QA MATRIX] Launching multi-context testing matrix...");
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });

  let hasErrors = false;
  let errorLog = [];

  function attachErrorListeners(page, contextName) {
    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('favicon')) {
        console.error(`[${contextName}] Console Error: ${msg.text()}`);
        hasErrors = true;
        errorLog.push(`[${contextName}] ${msg.text()}`);
      }
    });
    page.on('pageerror', err => {
      console.error(`[${contextName}] Page Error: ${err.message}`);
      hasErrors = true;
      errorLog.push(`[${contextName}] ${err.message}`);
    });
  }

  try {
    // === CONTEXT A: Desktop Guest Login ===
    console.log("[QA MATRIX] Booting Context A (Desktop Guest)...");
    const contextA = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const pageA = await contextA.newPage();
    attachErrorListeners(pageA, 'Context A');

    // === CONTEXT B: Desktop Sign Up ===
    console.log("[QA MATRIX] Booting Context B (Desktop Sign Up)...");
    const contextB = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const pageB = await contextB.newPage();
    attachErrorListeners(pageB, 'Context B');

    // === CONTEXT C: Mobile Guest ===
    console.log("[QA MATRIX] Booting Context C (Mobile Emulation)...");
    const iPhone = devices['iPhone 13'];
    const contextC = await browser.newContext({ ...iPhone });
    const pageC = await contextC.newPage();
    attachErrorListeners(pageC, 'Context C');

    // Run in parallel
    await Promise.all([
      (async () => {
        await pageA.goto('https://lukman-cloud.vercel.app/', { waitUntil: 'load' });
        await pageA.waitForTimeout(1000);
        // Look for guest access button (text was changed to "Instant Guest Access")
        const guestBtn = pageA.getByRole('button', { name: /Instant Guest Access/i });
        if (await guestBtn.isVisible()) {
          await guestBtn.click();
          await pageA.waitForTimeout(500);
          const confirmBtn = pageA.getByRole('button', { name: /Continue|Enter/i });
          if (await confirmBtn.isVisible()) await confirmBtn.click();
        }
        await pageA.waitForTimeout(2000);
        await pageA.screenshot({ path: 'matrix_contextA.png' });
      })(),

      (async () => {
        await pageB.goto('https://lukman-cloud.vercel.app/', { waitUntil: 'load' });
        await pageB.waitForTimeout(1000);
        // We will just attempt to interact with the auth form to check input boundaries
        const emailInput = pageB.locator('input[type="email"]');
        if (await emailInput.isVisible()) {
          await emailInput.fill('testmatrix@lukman.cloud');
          const pwInput = pageB.locator('input[type="password"]');
          if (await pwInput.isVisible()) {
            await pwInput.fill('password123');
            // test eye toggle
            const eyeBtn = pageB.locator('button[aria-label="Show password"]');
            if (await eyeBtn.isVisible()) {
                await eyeBtn.click();
            }
          }
        }
        await pageB.waitForTimeout(2000);
        await pageB.screenshot({ path: 'matrix_contextB.png' });
      })(),

      (async () => {
        await pageC.goto('https://lukman-cloud.vercel.app/', { waitUntil: 'load' });
        await pageC.waitForTimeout(1000);
        const guestBtn = pageC.getByRole('button', { name: /Instant Guest Access/i });
        if (await guestBtn.isVisible()) {
          await guestBtn.click();
          await pageC.waitForTimeout(500);
          const confirmBtn = pageC.getByRole('button', { name: /Continue|Enter/i });
          if (await confirmBtn.isVisible()) await confirmBtn.click();
        }
        await pageC.waitForTimeout(2000);
        await pageC.screenshot({ path: 'matrix_contextC.png' });
      })()
    ]);

    if (hasErrors) {
      console.error("[QA MATRIX] ERRORS DETECTED!");
      process.exit(1);
    } else {
      console.log("[QA MATRIX] SUCCESS. 0% Error Rate.");
    }
  } catch (e) {
    console.error("[QA MATRIX] Orchestration failed: ", e.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
