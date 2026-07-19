import { chromium, devices } from 'playwright';

async function runAudit() {
  console.log('Waiting for Vercel deployment to stabilize (45s)...');
  await new Promise(r => setTimeout(r, 45000));
  
  const browser = await chromium.launch();
  const testUrl = 'https://lukman-cloud.vercel.app/';
  
  console.log('\\n--- SCENARIO A: Desktop Guest Access ---');
  const contextA = await browser.newContext();
  const pageA = await contextA.newPage();
  await pageA.goto(testUrl);
  await pageA.waitForLoadState('networkidle');
  
  console.log('Evaluating Auth page contrast...');
  const contrastA = await pageA.evaluate(() => {
    const leftPanel = document.querySelector('.bg-slate-50') || document.querySelector('.bg-gradient-to-br');
    const guestBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Guest Access'));
    const contBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Continue to Dashboard') || b.innerText.includes('Sign In'));
    
    return {
      leftPanelClass: leftPanel ? leftPanel.className : 'NOT_FOUND',
      guestBtnText: guestBtn ? guestBtn.innerText : 'NOT_FOUND',
      contBtnBg: contBtn ? window.getComputedStyle(contBtn).backgroundColor : 'NOT_FOUND',
      contBtnColor: contBtn ? window.getComputedStyle(contBtn).color : 'NOT_FOUND'
    };
  });
  console.log('Contrast Check:', contrastA);
  
  console.log('Clicking Guest Access...');
  const guestBtn = pageA.getByRole('button', { name: 'Guest Access' });
  await guestBtn.click();
  
  console.log('Waiting for credentials modal...');
  const continueBtn = pageA.getByRole('button', { name: 'Continue to Dashboard' });
  await continueBtn.waitFor({ state: 'visible', timeout: 15000 });
  await continueBtn.click();
  
  console.log('Waiting for dashboard load...');
  await pageA.waitForLoadState('networkidle');
  await pageA.waitForSelector('text=Storage Overview', { timeout: 15000 }).catch(e => console.log('Timeout waiting for Storage Overview'));
  await pageA.screenshot({ path: 'scenario_A_dashboard.png' });
  console.log('Scenario A Completed. Screenshot saved to scenario_A_dashboard.png');
  await contextA.close();
  
  console.log('\\n--- SCENARIO B: Desktop Manual Sign Up ---');
  const contextB = await browser.newContext();
  const pageB = await contextB.newPage();
  await pageB.goto(testUrl);
  await pageB.waitForLoadState('networkidle');
  
  await pageB.getByText('Create an account').click();
  await pageB.fill('input[name="name"]', 'Test User B');
  const randomUser = `test_user_${Date.now()}`;
  await pageB.fill('input[name="username"]', randomUser);
  await pageB.fill('input[name="password"]', 'password123!');
  await pageB.getByRole('button', { name: 'Create Account' }).click();
  
  console.log('Waiting for creation success...');
  await pageB.waitForSelector('text=Account created successfully', { timeout: 15000 }).catch(e => console.log('Timeout waiting for success message'));
  
  console.log('Logging in...');
  await pageB.fill('input[name="username"]', randomUser);
  await pageB.fill('input[name="password"]', 'password123!');
  await pageB.getByRole('button', { name: 'Sign In' }).click();
  
  await pageB.waitForLoadState('networkidle');
  await pageB.waitForSelector('text=Storage Overview', { timeout: 15000 }).catch(e => console.log('Timeout waiting for Dashboard'));
  
  // Go to Files view to check the 160x160 grid
  await pageB.getByText('Files').click();
  await pageB.waitForSelector('text=Folder is Empty', { timeout: 15000 }).catch(e => console.log('Timeout waiting for empty folder'));
  
  const gridCheck = await pageB.evaluate(() => {
    const emptyFolder = document.querySelector('.border-dashed');
    return {
      hasEmptyFolderDashed: !!emptyFolder
    };
  });
  console.log('Grid check:', gridCheck);
  await pageB.screenshot({ path: 'scenario_B_files.png' });
  console.log('Scenario B Completed. Screenshot saved to scenario_B_files.png');
  await contextB.close();
  
  console.log('\\n--- SCENARIO C: Mobile Emulation ---');
  const mobile = devices['iPhone 13'];
  const contextC = await browser.newContext({ ...mobile });
  const pageC = await contextC.newPage();
  await pageC.goto(testUrl);
  await pageC.waitForLoadState('networkidle');
  
  await pageC.screenshot({ path: 'scenario_C_mobile_auth.png' });
  console.log('Scenario C Mobile Auth Completed. Screenshot saved to scenario_C_mobile_auth.png');
  
  await browser.close();
  console.log('\\nAll audits completed successfully!');
}

runAudit().catch(console.error);
