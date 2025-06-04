
#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Building application for production...');

try {
  // Build client
  console.log('Building client...');
  execSync('npx vite build', { stdio: 'inherit', cwd: 'client' });

  // Ensure dist directory exists
  if (!fs.existsSync('dist')) {
    fs.mkdirSync('dist', { recursive: true });
  }

  // Copy server files to dist
  console.log('Copying server files...');
  execSync('cp -r server/* dist/', { stdio: 'inherit' });

  console.log('Build completed successfully!');
} catch (error) {
  console.error('Build failed:', error);
  process.exit(1);
}
