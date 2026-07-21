import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    permissions: ['clipboard-read', 'clipboard-write']
  });
  
  const page = await context.newPage();
  console.log("Navigating to live Vercel deployment...");
  await page.goto('https://lukman-cloud.vercel.app/', { waitUntil: 'networkidle' });
  
  // 1. Generate Guest Session
  console.log("Generating Guest Session...");
  await page.click('text="Instant Guest Access"');
  await page.waitForSelector('text="New"', { timeout: 15000 });
  console.log("Logged in!");
  
  // 2. Wait for VFS to load
  await page.waitForTimeout(4000);
  
  const uploadDir = 'D:\\luke project\\test upload file folder';
  
  // Choose 5 files to upload
  const files = [
    path.join(uploadDir, 'test1.txt'),
    path.join(uploadDir, 'testfile.txt'),
    path.join(uploadDir, 'e2e_test_file.txt'),
    path.join(uploadDir, 'Curriculum Vitae LUKMAN NURHAKIM.pdf'),
    path.join(uploadDir, 'photo_6208320852542033884_y (3) (1).jpg'),
  ];
  
  console.log("Starting multiple file upload via input[type=file]...");
  
  // wait for input type=file, wait for it to attach
  const fileChooserPromise = page.waitForEvent('filechooser');
  // Click on "New" -> "File Upload"
  await page.click('text="New"');
  await page.waitForTimeout(1000);
  await page.click('text="File Upload"');
  
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(files);
  
  console.log("Files set. Monitoring network requests to verify concurrency...");
  
  // We can monitor concurrency by checking how many simultaneous POST requests to supabase storage are active
  let activeUploads = 0;
  let maxActiveUploads = 0;
  
  page.on('request', request => {
    if (request.method() === 'POST' && request.url().includes('/storage/v1/object')) {
      activeUploads++;
      if (activeUploads > maxActiveUploads) {
        maxActiveUploads = activeUploads;
      }
      console.log(`[Request started] ${request.url().substring(0,60)}... Active: ${activeUploads}`);
    }
  });
  
  page.on('requestfinished', request => {
    if (request.method() === 'POST' && request.url().includes('/storage/v1/object')) {
      activeUploads--;
      console.log(`[Request finished] Active: ${activeUploads}`);
    }
  });
  
  page.on('requestfailed', request => {
    if (request.method() === 'POST' && request.url().includes('/storage/v1/object')) {
      activeUploads--;
      console.log(`[Request failed] Active: ${activeUploads}`);
    }
  });

  // wait until the upload toast finishes or wait for 30s
  await page.waitForTimeout(20000);
  
  console.log(`Max active uploads observed: ${maxActiveUploads}`);
  if (maxActiveUploads <= 3 && maxActiveUploads > 0) {
    console.log("SUCCESS: 3-file concurrency cap is verified.");
  } else {
    console.error(`FAILURE: Expected max active <= 3, got ${maxActiveUploads}`);
  }
  
  await browser.close();
})();
