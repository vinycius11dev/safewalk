/* global __dirname */
const { copyFileSync, mkdirSync } = require('node:fs');
const path = require('node:path');

// Metro does not emit MapLibre's external module worker automatically. Serve the
// installed, matching worker as a same-origin public asset in dev and exports.
const mobileRoot = path.resolve(__dirname, '../../..');
const publicRoot = path.join(mobileRoot, 'public');
mkdirSync(publicRoot, { recursive: true });
copyFileSync(
  require.resolve('maplibre-gl/dist/maplibre-gl-worker.mjs'),
  path.join(publicRoot, 'maplibre-worker.mjs'),
);
