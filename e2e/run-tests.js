#!/usr/bin/env node
/* eslint-disable no-console */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Check if we need to build first
const distPath = path.join(__dirname, '../release/app/dist');
const needsBuild = !fs.existsSync(distPath);

async function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      ...options,
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Command failed with code ${code}`));
      } else {
        resolve();
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

async function main() {
  try {
    console.log('🚀 Starting E2E tests...\n');

    if (needsBuild) {
      console.log('📦 Building application for tests...');
      await runCommand('npm', ['run', 'build']);
      console.log('✅ Build complete\n');
    }

    console.log('🧪 Running Playwright tests...');

    // Pass through any additional arguments to playwright
    const args = process.argv.slice(2);
    await runCommand('npx', ['playwright', 'test', ...args]);

    console.log('✅ Tests complete!');
  } catch (error) {
    console.error('❌ Test execution failed:', error.message);
    process.exit(1);
  }
}

main();
