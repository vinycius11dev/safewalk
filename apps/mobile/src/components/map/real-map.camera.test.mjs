import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fitVisibleRoute } from './real-map.camera';

// Exercise the installed GL 6 camera math directly, with no DOM, browser or tile requests.
const require = createRequire(import.meta.url);
const libraryRoot = dirname(require.resolve('maplibre-gl/package.json'));
const { Camera } = await import(pathToFileURL(join(libraryRoot, 'src/ui/camera.ts')).href);
const { LngLat } = await import(pathToFileURL(join(libraryRoot, 'src/geo/lng_lat.ts')).href);
const { browser } = await import(pathToFileURL(join(libraryRoot, 'src/util/browser.ts')).href);
browser.prefersReducedMotion = true;
const route = [
  { latitude: -23.5641, longitude: -46.6521 },
  { latitude: -23.564356, longitude: -46.655992 },
  { latitude: -23.553489, longitude: -46.651365 },
  { latitude: -23.5535, longitude: -46.6527 },
];
const padding = { top: 140, right: 45, bottom: 384, left: 45 };

test('GL 6 fits the complete public-landmark route above the fixed sheet after resize and repeated fitting', () => {
  const camera = new Camera({
    bearingSnap: 7,
    zoomSnap: 0,
    requestRenderFrame: () => 0,
    cancelRenderFrame: () => {},
    transformConstrain: null,
  });
  camera.transform.resize(390, 300); // stale initial canvas, too short for the requested insets
  camera.jumpTo({ center: [-46.6521, -23.5641], zoom: 15.3 });
  let width = 390;
  let height = 844;
  const operations = [];
  const map = {
    stop() {
      operations.push('stop');
      camera.stop();
      return this;
    },
    resize() {
      operations.push('resize');
      camera.transform.resize(width, height);
      return this;
    },
    fitBounds(bounds, options) {
      operations.push('fit');
      camera.fitBounds(bounds, options);
      return this;
    },
  };
  const screenPoints = () =>
    route.map((point) =>
      camera.transform.locationToScreenPoint(new LngLat(point.longitude, point.latitude)),
    );
  for (let pass = 0; pass < 2; pass++) {
    assert.equal(fitVisibleRoute(map, route, padding, '2d'), true);
    for (const point of screenPoints()) {
      assert.ok(point.x >= padding.left - 0.1 && point.x <= width - padding.right + 0.1);
      assert.ok(point.y >= padding.top - 0.1 && point.y <= height - padding.bottom + 0.1);
    }
  }
  const beforeResize = screenPoints();
  assert.ok(beforeResize[0].y > 400 && beforeResize[0].y < 460);
  assert.ok(beforeResize.at(-1).y >= 140 && beforeResize.at(-1).y < 150);
  width = 430;
  height = 932;
  fitVisibleRoute(map, route, padding, '2d');
  for (const point of screenPoints())
    assert.ok(point.y >= 139.9 && point.y <= height - padding.bottom + 0.1);
  assert.deepEqual(operations, [
    'stop',
    'resize',
    'fit',
    'stop',
    'resize',
    'fit',
    'stop',
    'resize',
    'fit',
  ]);
  assert.deepEqual(camera.getPadding(), padding);
});

test('route framing never manufactures a route or a GPS position', () => {
  const map = {
    stop() {
      throw new Error('No route to frame');
    },
  };
  assert.equal(fitVisibleRoute(map, undefined, padding, '2d'), false);
  assert.equal(fitVisibleRoute(map, [route[0]], padding, '2d'), false);
});
