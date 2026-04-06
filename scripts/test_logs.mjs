import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err));
  
  console.log('Navigating to http://localhost:3002/login');
  await page.goto('http://localhost:3002/login', { waitUntil: 'load' });
  
  console.log('Waiting for form animations...');
  await page.waitForTimeout(1000);
  console.log('Typing login details...');
  await page.focus('#email');
  await page.keyboard.type('superadmin@example.com', { delay: 50 });
  await page.focus('#password');
  await page.keyboard.type('Password123!', { delay: 50 });
  await page.screenshot({ path: 'login_before.png' });
  
  console.log('Clicking submit...');
  await page.click('button[type="submit"]');
  
  console.log('Waiting for 5 seconds to observe logs...');
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'login_after.png' });
  
  await browser.close();
})();
