import { test, _electron as electron } from '@playwright/test';
import path from 'path';

test('debug app launch', async () => {
  const appPath = path.join(__dirname, '../release/app');

  // eslint-disable-next-line no-console
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
  const appInfo = await app.evaluate(async ({ app: electronApp }) => {
    return {
      name: electronApp.getName(),
      version: electronApp.getVersion(),
      isPackaged: electronApp.isPackaged,
      path: electronApp.getAppPath(),
    };
  });

  // eslint-disable-next-line no-console
  console.log('App info:', appInfo);

  // Wait for window
  // eslint-disable-next-line no-console
  console.log('Waiting for window...');
  const page = await app.firstWindow();
  // eslint-disable-next-line no-console
  console.log('Window opened');

  // Check for console errors
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      // eslint-disable-next-line no-console
      console.error('Console error:', msg.text());
    }
  });

  // Wait for page to load
  await page.waitForLoadState('domcontentloaded');

  // Take a screenshot
  await page.screenshot({ path: 'e2e/screenshots/debug.png' });
  // eslint-disable-next-line no-console
  console.log('Screenshot saved to e2e/screenshots/debug.png');

  // Check page title
  const title = await page.title();
  // eslint-disable-next-line no-console
  console.log('Page title:', title);

  // Check if main elements exist
  const hasBody = await page.locator('body').count();
  // eslint-disable-next-line no-console
  console.log('Has body element:', hasBody > 0);

  // Try to get the root element
  const rootElement = await page.locator('#root').count();
  // eslint-disable-next-line no-console
  console.log('Has root element:', rootElement > 0);

  // Get page content snippet
  const bodyContent = await page.locator('body').innerHTML();
  // eslint-disable-next-line no-console
  console.log('Body content (first 500 chars):', bodyContent.substring(0, 500));

  // Wait a bit to see if any errors appear
  await page.waitForTimeout(2000);

  await app.close();
});
