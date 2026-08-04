/**
 * Post-export step: inject PWA <head> tags into the web build.
 *
 * Expo Router only applies app/+html.tsx when web.output is "static".
 * This app runs in SPA mode (output: "single"), so +html.tsx is ignored and
 * the generated index.html has no manifest/apple-touch-icon links. Without a
 * <link rel="manifest">, Android can't read manifest.json and falls back to
 * the tiny favicon.ico (upscaled => blurry home-screen icon).
 *
 * This script patches dist/index.html after `expo export`. It is idempotent.
 */
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'dist', 'index.html');

if (!fs.existsSync(file)) {
  console.error('[patch-pwa-head] dist/index.html not found - run expo export first');
  process.exit(1);
}

let html = fs.readFileSync(file, 'utf8');

if (html.includes('rel="manifest"')) {
  console.log('[patch-pwa-head] manifest link already present - skipping');
  process.exit(0);
}

const tags = [
  '<link rel="manifest" href="/manifest.json" />',
  '<link rel="apple-touch-icon" sizes="192x192" href="/icons/icon-192.png" />',
  '<link rel="apple-touch-icon" sizes="512x512" href="/icons/icon-512.png" />',
  '<meta name="mobile-web-app-capable" content="yes" />',
  '<meta name="apple-mobile-web-app-capable" content="yes" />',
  '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />',
  '<meta name="apple-mobile-web-app-title" content="Dritchwear" />',
].map((t) => '    ' + t).join('\n');

html = html.replace('</head>', tags + '\n  </head>');
fs.writeFileSync(file, html);
console.log('[patch-pwa-head] injected PWA head tags into dist/index.html');
