/* eslint-disable no-console */
/* eslint-disable global-require */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-promise-executor-return */
/* eslint-disable no-plusplus */
/* eslint-disable import/prefer-default-export */
import {
  _electron as electron,
  ElectronApplication,
  Page,
} from '@playwright/test';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';

export class ElectronHelper {
  private static devServer: ChildProcess | null = null;

  private static mainProcess: ChildProcess | null = null;

  /**
   * Start the Electron app in dev mode for testing
   */
  static async startDevApp(): Promise<{
    app: ElectronApplication;
    page: Page;
  }> {
    const rootPath = path.join(__dirname, '..');

    // Clean test database
    const testDbPath = path.join(__dirname, 'fixtures/test-db.sqlite');
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    // Set test environment variables
    const testEnv = {
      ...process.env,
      NODE_ENV: 'test',
      TEST_MODE: 'true',
      TEST_DB_PATH: testDbPath,
      TEST_SONGS_PATH: path.join(__dirname, 'fixtures/test-songs'),
    };

    console.log('Starting Electron app in test mode...');

    // Start the renderer dev server first
    await this.startRendererServer(testEnv);

    // Wait for server to be ready
    await this.waitForPort(1212, 30000);

    // Launch Electron with the main process
    const electronPath = require('electron') as unknown as string;
    const app = await electron.launch({
      executablePath: electronPath,
      args: [rootPath],
      env: testEnv,
      timeout: 30000,
    });

    // Wait for the first window
    const page = await this.waitForWindow(app);

    // Wait for React to load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Give React time to initialize

    return { app, page };
  }

  /**
   * Start the renderer dev server
   */
  private static async startRendererServer(
    env: Record<string, string | undefined>,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      // Override NODE_ENV in the command itself
      const command =
        process.platform === 'win32'
          ? `set NODE_ENV=test&& set TEST_MODE=true&& npm run start:renderer`
          : `NODE_ENV=test TEST_MODE=true npm run start:renderer`;

      this.devServer = spawn(command, [], {
        env,
        stdio: 'pipe',
        shell: true,
        cwd: path.join(__dirname, '..'),
      });

      this.devServer.stdout?.on('data', (data) => {
        const output = data.toString();
        console.log('Renderer:', output);
        if (
          output.includes('compiled successfully') ||
          output.includes('Compiled with')
        ) {
          resolve();
        }
      });

      this.devServer.stderr?.on('data', (data) => {
        console.error('Renderer Error:', data.toString());
      });

      this.devServer.on('error', (error) => {
        reject(error);
      });

      // Set a timeout
      setTimeout(() => {
        resolve(); // Assume it's ready after timeout
      }, 15000);
    });
  }

  /**
   * Wait for a port to be available
   */
  private static async waitForPort(
    port: number,
    timeout: number,
  ): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        const response = await fetch(`http://localhost:${port}`);
        if (response.ok || response.status) {
          return;
        }
      } catch (error) {
        // Port not ready yet
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    throw new Error(
      `Port ${port} did not become available within ${timeout}ms`,
    );
  }

  /**
   * Wait for the first window with retries
   */
  private static async waitForWindow(app: ElectronApplication): Promise<Page> {
    let retries = 0;
    const maxRetries = 10;

    while (retries < maxRetries) {
      try {
        const page = await app.firstWindow();
        if (page) return page;
      } catch (error) {
        console.log(
          `Waiting for window... (attempt ${retries + 1}/${maxRetries})`,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
      retries++;
    }

    throw new Error('Failed to get first window after multiple attempts');
  }

  /**
   * Stop the dev server and Electron app
   */
  static async cleanup(app?: ElectronApplication): Promise<void> {
    if (app) {
      try {
        await app.close();
      } catch (error) {
        console.error('Error closing Electron app:', error);
      }
    }

    if (this.devServer) {
      this.devServer.kill('SIGTERM');
      this.devServer = null;
    }

    if (this.mainProcess) {
      this.mainProcess.kill('SIGTERM');
      this.mainProcess = null;
    }

    // Give processes time to clean up
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}
