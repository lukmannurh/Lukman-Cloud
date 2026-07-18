import { chromium } from 'playwright';

const PROD_URL = 'https://lukman-cloud.vercel.app/';

async function testNewFolder() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    console.log('Logging in...');
    await page.goto(PROD_URL);
    await page.click('text="Create an account"').catch(() => {});
    await page.fill('input[name="name"]', 'Test User');
    await page.fill('input[name="username"]', `test_${Date.now()}`);
    await page.fill('input[name="password"]', 'Password123!');
    await page.click('button:has-text("Create Account")');
    await page.waitForSelector('text=Account created successfully', { timeout: 10000 }).catch(() => {});
    await page.fill('input[name="password"]', 'Password123!');
    await page.click('button:has-text("Sign In")');
    
    console.log('Waiting for Dashboard...');
    await page.waitForSelector('text=Dashboard', { timeout: 15000 });
    
    console.log('Clicking New...');
    await page.click('button:has-text("New")');
    console.log('Clicking New Folder...');
    await page.click('button:has-text("New Folder")', { force: true });
    
    console.log('Waiting for Folder Name input...');
    await page.waitForSelector('input[placeholder="Folder Name"]', { timeout: 5000 });
    console.log('Filling input...');
    await page.fill('input[placeholder="Folder Name"]', 'Platinum Matrix Folder');
    
    console.log('Success!');
  } catch (error) {
    console.error('Error:', error);
    await page.screenshot({ path: 'scratch/new_folder_fail.png' });
  } finally {
    await browser.close();
  }
}

testNewFolder();
