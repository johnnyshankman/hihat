import { test, expect } from '@playwright/test';
import { ElectronHelper } from './electron-helper';

test.describe('Simple Electron Test', () => {
  let app: any;
  let page: any;

  test.beforeAll(async () => {
    const result = await ElectronHelper.startDevApp();
    app = result.app;
    page = result.page;
  });

  test.afterAll(async () => {
    await ElectronHelper.cleanup(app);
  });

  test('should launch and display the app', async () => {
    // Check app name
    const appName = await app.evaluate(async ({ app }: any) => {
      return app.getName();
    });
    expect(appName).toBe('hihat');

    // Check that the page has loaded
    const title = await page.title();
    expect(title).toBeTruthy();

    // Look for the root element
    const rootElement = await page.locator('#root');
    await expect(rootElement).toBeVisible();

    // Take a screenshot for debugging
    await page.screenshot({ path: 'e2e/screenshots/app-launched.png' });
    
    // Check if there are any critical errors in console
    const logs: string[] = [];
    page.on('console', (msg: any) => {
      if (msg.type() === 'error') {
        logs.push(msg.text());
      }
    });
    
    // Wait a bit to catch any delayed errors
    await page.waitForTimeout(3000);
    
    // Check that there are no critical errors
    const criticalErrors = logs.filter(log => 
      log.includes('Failed to load') || 
      log.includes('Cannot read') ||
      log.includes('undefined')
    );
    
    if (criticalErrors.length > 0) {
      console.log('Critical errors found:', criticalErrors);
    }
    
    // Try to find main UI elements
    const bodyHTML = await page.locator('body').innerHTML();
    console.log('Page loaded with content length:', bodyHTML.length);
    
    // The app should have some content
    expect(bodyHTML.length).toBeGreaterThan(100);
  });
});