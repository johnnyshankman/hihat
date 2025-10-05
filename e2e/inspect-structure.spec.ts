import { test } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';

test('inspect app structure', async () => {
  const { app, page } = await TestHelpers.launchApp();

  // Take a screenshot
  await page.screenshot({ path: 'e2e/screenshots/full-app.png' });

  // Get all elements with class names that might be components
  const elements = await page.evaluate(() => {
    const result: Record<string, string[]> = {};

    // Find elements by common patterns
    const patterns = [
      { selector: '[class*="drawer"]', name: 'drawer' },
      { selector: '[class*="sidebar"]', name: 'sidebar' },
      { selector: '[class*="player"]', name: 'player' },
      { selector: '[class*="library"]', name: 'library' },
      { selector: '[class*="table"]', name: 'table' },
      { selector: '[class*="toolbar"]', name: 'toolbar' },
      { selector: '[class*="navigation"]', name: 'navigation' },
      { selector: '[class*="MuiBox"]', name: 'box' },
      { selector: '[class*="MuiDrawer"]', name: 'mui-drawer' },
    ];

    patterns.forEach(({ selector, name }) => {
      const els = document.querySelectorAll(selector);
      if (els.length > 0) {
        result[name] = Array.from(els)
          .slice(0, 3)
          .map((el) => {
            const { className } = el;
            const { id } = el;
            const tag = el.tagName.toLowerCase();
            return `${tag}${id ? `#${id}` : ''}${className ? `.${className.split(' ').slice(0, 2).join('.')}` : ''}`;
          });
      }
    });

    return result;
  });

  // eslint-disable-next-line no-console
  console.log('Found elements:', JSON.stringify(elements, null, 2));

  // Look for specific MUI components
  const muiComponents = await page.evaluate(() => {
    const components: Record<string, number> = {};
    const selectors = [
      'MuiDrawer',
      'MuiAppBar',
      'MuiToolbar',
      'MuiButton',
      'MuiIconButton',
      'MuiTable',
      'MuiDataGrid',
    ];

    selectors.forEach((name) => {
      const count = document.querySelectorAll(`[class*="${name}"]`).length;
      if (count > 0) {
        components[name] = count;
      }
    });

    return components;
  });

  // eslint-disable-next-line no-console
  console.log('MUI Components found:', muiComponents);

  // Check for specific content
  const hasLibraryView = await page.locator('text=/library/i').count();
  const hasPlaylistView = await page.locator('text=/playlist/i').count();
  const hasSettings = await page.locator('text=/settings/i').count();

  // eslint-disable-next-line no-console
  console.log('Content checks:');
  // eslint-disable-next-line no-console
  console.log('- Has library text:', hasLibraryView > 0);
  // eslint-disable-next-line no-console
  console.log('- Has playlist text:', hasPlaylistView > 0);
  // eslint-disable-next-line no-console
  console.log('- Has settings text:', hasSettings > 0);

  // Check the page structure
  const bodyHTML = await page.locator('body').innerHTML();
  // eslint-disable-next-line no-console
  console.log('\nHTML structure preview (first 1000 chars):');
  // eslint-disable-next-line no-console
  console.log(bodyHTML.substring(0, 1000));

  await TestHelpers.closeApp(app);
});
