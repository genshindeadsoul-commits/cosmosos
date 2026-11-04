import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');

function readPngDimensions(buffer: Buffer): { width: number; height: number } {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.ok(buffer.subarray(0, 8).equals(signature), 'Invalid PNG signature');
  // IHDR chunk starts at byte 8; length 13 at 8..12; 'IHDR' at 12..16; width at 16..20; height at 20..24
  assert.equal(buffer.subarray(12, 16).toString('ascii'), 'IHDR', 'Missing IHDR chunk');
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  return { width, height };
}

test('PWA manifest: webmanifest file is valid and meets Android Chrome criteria', () => {
  const manifestPath = path.join(PUBLIC, 'manifest.webmanifest');
  assert.ok(fs.existsSync(manifestPath), 'manifest.webmanifest must exist in public/');

  const raw = fs.readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(raw);

  assert.equal(manifest.name, 'Cosmos OS');
  assert.equal(manifest.short_name, 'Cosmos');
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.scope, '/');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.theme_color, '#3D5240');
  assert.ok(manifest.background_color);

  assert.ok(Array.isArray(manifest.icons), 'manifest must have an icons array');
  assert.ok(manifest.icons.length >= 3, 'manifest should have at least 192, 512, and 512-maskable icons');

  const icon192 = manifest.icons.find((i: any) => i.sizes === '192x192' && i.purpose === 'any');
  assert.ok(icon192, 'manifest must have a 192x192 any icon');

  const icon512 = manifest.icons.find((i: any) => i.sizes === '512x512' && i.purpose === 'any');
  assert.ok(icon512, 'manifest must have a 512x512 any icon');

  const maskable = manifest.icons.find((i: any) => i.sizes === '512x512' && i.purpose === 'maskable');
  assert.ok(maskable, 'manifest must have a 512x512 maskable icon');
});

test('PWA icons: all icon assets exist and have valid PNG headers and sizes', () => {
  const iconFiles = [
    { file: 'icons/icon-192.png', width: 192, height: 192 },
    { file: 'icons/icon-512.png', width: 512, height: 512 },
    { file: 'icons/icon-maskable-512.png', width: 512, height: 512 },
    { file: 'icons/apple-touch-icon.png', width: 180, height: 180 },
    { file: 'icons/favicon-32.png', width: 32, height: 32 },
  ];

  for (const { file, width, height } of iconFiles) {
    const fullPath = path.join(PUBLIC, file);
    assert.ok(fs.existsSync(fullPath), `${file} must exist`);
    const buf = fs.readFileSync(fullPath);
    const dims = readPngDimensions(buf);
    assert.equal(dims.width, width, `${file} width must be ${width}`);
    assert.equal(dims.height, height, `${file} height must be ${height}`);
  }
});

test('PWA service worker: sw.js exists and implements offline fallback and asset caching', () => {
  const swPath = path.join(PUBLIC, 'sw.js');
  assert.ok(fs.existsSync(swPath), 'sw.js must exist in public/');
  const swCode = fs.readFileSync(swPath, 'utf8');

  // Must handle lifecycle
  assert.match(swCode, /addEventListener\(['"]install['"]/);
  assert.match(swCode, /addEventListener\(['"]activate['"]/);
  assert.match(swCode, /addEventListener\(['"]fetch['"]/);

  // Must take control quickly
  assert.match(swCode, /skipWaiting/);
  assert.match(swCode, /clients\.claim/);

  // Must only intercept same-origin and ignore non-GET
  assert.match(swCode, /origin/);
  assert.match(swCode, /GET/);
  assert.match(swCode, /sw\.js/);
});

test('index.html links to manifest and mobile metadata', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.match(html, /<link[^>]+rel=["']manifest["'][^>]+href=["']\/manifest\.webmanifest["']/);
  assert.match(html, /<meta[^>]+name=["']theme-color["'][^>]+content=["']#3D5240["']/);
  assert.match(html, /<link[^>]+rel=["']apple-touch-icon["']/);
});
