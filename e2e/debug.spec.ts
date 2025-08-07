import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';
import fs from 'fs';

test('debug app launch', async () => {
  const appPath = path.join(__dirname, '../release/app');
  
  console.log('Launching app from:', appPath);
  
  const app = await electron.launch({
    args: [appPath],
    env: {
      ...process.env,
      NODE_ENV: 'test',
      TEST_MODE: 'true',
    },
    timeout: 30000,
  });
  
  // Get app info
  const appInfo = await app.evaluate(async ({ app }) => {
    return {
      name: app.getName(),
      version: app.getVersion(),
      isPackaged: app.isPackaged,
      path: app.getAppPath(),
    };
  });
  
  console.log('App info:', appInfo);
  
  // Wait for window
  console.log('Waiting for window...');
  const page = await app.firstWindow();
  console.log('Window opened');
  
  // Check for console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.error('Console error:', msg.text());
    }
  });
  
  // Wait for page to load
  await page.waitForLoadState('domcontentloaded');
  
  // Take a screenshot
  await page.screenshot({ path: 'e2e/screenshots/debug.png' });
  console.log('Screenshot saved to e2e/screenshots/debug.png');
  
  // Check page title
  const title = await page.title();
  console.log('Page title:', title);
  
  // Check if main elements exist
  const hasBody = await page.locator('body').count();
  console.log('Has body element:', hasBody > 0);
  
  // Try to get the root element
  const rootElement = await page.locator('#root').count();
  console.log('Has root element:', rootElement > 0);
  
  // Get page content snippet
  const bodyContent = await page.locator('body').innerHTML();
  console.log('Body content (first 500 chars):', bodyContent.substring(0, 500));
  
  // Wait a bit to see if any errors appear
  await page.waitForTimeout(2000);
  
  await app.close();
});