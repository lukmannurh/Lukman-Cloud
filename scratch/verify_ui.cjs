const { chromium } = require('playwright-core');
const fs = require('fs');

(async () => {
  console.log("Starting browser...");
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  let hasErrors = false;
  let hasCspViolations = false;

  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`[Browser Console Error] ${msg.text()}`);
      if (msg.text().includes('Content Security Policy')) {
        hasCspViolations = true;
      } else if (!msg.text().includes('favicon.ico')) {
        // Ignore favicon 404
        hasErrors = true;
      }
    } else if (msg.type() === 'warning') {
      console.log(`[Browser Console Warning] ${msg.text()}`);
    }
  });

  page.on('pageerror', err => {
    console.log(`[Browser Page Error] ${err.message}`);
    hasErrors = true;
  });

  try {
    console.log("Navigating to http://localhost:5173...");
    await page.goto('http://localhost:5173', { waitUntil: 'load' });
    
    // Wait for render
    await page.waitForTimeout(2000);

    const bodyStyle = await page.evaluate(() => {
        const body = document.body;
        const computed = window.getComputedStyle(body);
        return {
            backgroundColor: computed.backgroundColor,
            fontFamily: computed.fontFamily,
            color: computed.color
        };
    });

    console.log("Computed Body Styles:");
    console.log(JSON.stringify(bodyStyle, null, 2));

    await page.screenshot({ path: 'phase1-render.png' });
    console.log("Screenshot saved to phase1-render.png");
    
    if (hasCspViolations) {
        console.error("CSP Violations Detected!");
        process.exit(1);
    }
    
    if (hasErrors) {
        console.error("Browser Console Errors Detected!");
        process.exit(1);
    }
    
    console.log("Success! No CSP violations or console errors.");

  } catch (err) {
    console.error("Test execution error:", err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
