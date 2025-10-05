/* eslint-disable @typescript-eslint/no-shadow */
/* eslint-disable no-console */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-promise-executor-return */
/* eslint-disable no-plusplus */
import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';
import fs from 'fs';

test.describe('Built App Tests', () => {
  test('should launch built app successfully', async () => {
    // Path to the built application
    const appPath = path.join(__dirname, '../release/app');
    const mainJsPath = path.join(appPath, 'dist/main/main.js');

    // Check if the app is built
    if (!fs.existsSync(mainJsPath)) {
      throw new Error(
        'Application not built. Please run "npm run build" first.',
      );
    }

    // Clean test database
    const testDbPath = path.join(__dirname, 'fixtures/test-db.sqlite');
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    console.log('Launching built app from:', appPath);

    // Launch the built Electron application with test environment
    const app = await electron.launch({
      args: [appPath],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        TEST_MODE: 'true',
        TEST_DB_PATH: testDbPath,
        TEST_SONGS_PATH: path.join(__dirname, 'fixtures/test-songs'),
      },
      timeout: 30000,
    });

    console.log('App launched, getting app info...');

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
    expect(appInfo.name).toBe('hihat');

    // Wait for the first window
    console.log('Waiting for window...');
    let page;
    let retries = 0;
    const maxRetries = 5;

    while (!page && retries < maxRetries) {
      try {
        page = await app.firstWindow();
        if (page) {
          console.log('Window found!');
          break;
        }
      } catch (error) {
        console.log(
          `Waiting for window... (attempt ${retries + 1}/${maxRetries})`,
        );
        await new Promise((resolve) => setTimeout(resolve, 2000));
        retries++;
      }
    }

    if (!page) {
      throw new Error('Failed to get first window');
    }

    // Set up console logging
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.error('Console error:', msg.text());
      }
    });

    // Wait for the page to load
    console.log('Waiting for page to load...');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000); // Give React time to render

    // Take a screenshot
    await page.screenshot({ path: 'e2e/screenshots/built-app.png' });
    console.log('Screenshot saved');

    // Check page title
    const title = await page.title();
    console.log('Page title:', title);
    expect(title).toBeTruthy();

    // Check if root element exists and has content
    const rootElement = await page.locator('#root');
    const rootExists = await rootElement.count();
    console.log('Root element exists:', rootExists > 0);
    expect(rootExists).toBeGreaterThan(0);

    // Get the HTML content to verify the app loaded
    const bodyHTML = await page.locator('body').innerHTML();
    console.log('Body HTML length:', bodyHTML.length);
    console.log('First 500 chars:', bodyHTML.substring(0, 500));

    // The app should have rendered content
    expect(bodyHTML.length).toBeGreaterThan(100);

    // Look for any main components (adjust based on your app structure)
    const hasContent = bodyHTML.includes('div') && bodyHTML.includes('root');
    expect(hasContent).toBe(true);

    // Clean up
    await app.close();
    console.log('Test completed successfully!');
  });
});
