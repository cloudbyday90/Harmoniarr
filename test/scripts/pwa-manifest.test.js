/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';

const rootDir = resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const manifestPath = resolve(rootDir, 'src', 'client', 'public', 'manifest.webmanifest');
const iconsDir = resolve(rootDir, 'src', 'client', 'public', 'icons');

describe('PWA manifest', () => {
  let manifest;

  it('is valid JSON', async () => {
    const source = await readFile(manifestPath, 'utf8');
    manifest = JSON.parse(source);
  });

  it('has required top-level fields', async () => {
    const source = await readFile(manifestPath, 'utf8');
    manifest = JSON.parse(source);

    assert.equal(typeof manifest.name, 'string', 'name must be a string');
    assert.ok(manifest.name.length > 0, 'name must not be empty');

    assert.equal(typeof manifest.short_name, 'string', 'short_name must be a string');
    assert.ok(manifest.short_name.length > 0, 'short_name must not be empty');

    assert.equal(typeof manifest.start_url, 'string', 'start_url must be a string');
    assert.ok(manifest.start_url.length > 0, 'start_url must not be empty');

    assert.equal(typeof manifest.display, 'string', 'display must be a string');
    assert.ok(
      ['standalone', 'fullscreen', 'minimal-ui', 'browser'].includes(manifest.display),
      `display "${manifest.display}" must be a valid display mode`,
    );

    assert.ok(Array.isArray(manifest.icons), 'icons must be an array');
    assert.ok(manifest.icons.length > 0, 'icons array must not be empty');
  });

  it('has required icon fields for each icon entry', async () => {
    const source = await readFile(manifestPath, 'utf8');
    manifest = JSON.parse(source);

    for (const icon of manifest.icons) {
      assert.equal(typeof icon.src, 'string', `icon.src must be a string, got ${JSON.stringify(icon.src)}`);
      assert.ok(icon.src.length > 0, 'icon.src must not be empty');

      assert.equal(typeof icon.sizes, 'string', `icon.sizes must be a string for src=${icon.src}`);
      assert.match(icon.sizes, /^\d+x\d+$/, `icon.sizes must match WxH pattern for src=${icon.src}`);

      assert.equal(typeof icon.type, 'string', `icon.type must be a string for src=${icon.src}`);
      assert.match(icon.type, /^image\//, `icon.type must be an image MIME type for src=${icon.src}`);
    }
  });

  it('has at least one icon at 192x192 or larger', async () => {
    const source = await readFile(manifestPath, 'utf8');
    manifest = JSON.parse(source);

    const hasLargeEnough = manifest.icons.some((icon) => {
      const [w] = icon.sizes.split('x').map(Number);
      return w >= 192;
    });
    assert.ok(hasLargeEnough, 'must have at least one icon with width >= 192px');
  });

  it('has at least one icon at 512x512 or larger', async () => {
    const source = await readFile(manifestPath, 'utf8');
    manifest = JSON.parse(source);

    const hasLargeEnough = manifest.icons.some((icon) => {
      const [w] = icon.sizes.split('x').map(Number);
      return w >= 512;
    });
    assert.ok(hasLargeEnough, 'must have at least one icon with width >= 512px');
  });

  it('has at least one maskable icon', async () => {
    const source = await readFile(manifestPath, 'utf8');
    manifest = JSON.parse(source);

    const hasMaskable = manifest.icons.some(
      (icon) => icon.purpose === 'maskable' || (typeof icon.purpose === 'string' && icon.purpose.includes('maskable')),
    );
    assert.ok(hasMaskable, 'must have at least one maskable icon for Android adaptive icon support');
  });

  it('display is standalone (not browser)', async () => {
    const source = await readFile(manifestPath, 'utf8');
    manifest = JSON.parse(source);

    assert.equal(manifest.display, 'standalone', 'display must be "standalone" for app-like behavior');
  });

  it('background_color and theme_color are valid hex colors', async () => {
    const source = await readFile(manifestPath, 'utf8');
    manifest = JSON.parse(source);

    const hexColor = /^#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?$/;

    if (manifest.background_color !== undefined) {
      assert.match(manifest.background_color, hexColor, 'background_color must be a valid hex color');
    }
    if (manifest.theme_color !== undefined) {
      assert.match(manifest.theme_color, hexColor, 'theme_color must be a valid hex color');
    }
  });
});

describe('PWA icon files', () => {
  it('all manifest icon src paths resolve to existing PNG files', async () => {
    const source = await readFile(manifestPath, 'utf8');
    const manifest = JSON.parse(source);

    for (const icon of manifest.icons) {
      // src is an absolute URL path like "/icons/icon-192.png"
      const relativePath = icon.src.replace(/^\//, '');
      const filePath = resolve(rootDir, 'src', 'client', 'public', relativePath);

      let fileBuffer;
      try {
        fileBuffer = await readFile(filePath);
      } catch {
        assert.fail(`Icon file not found: ${filePath} (manifest src="${icon.src}")`);
      }

      // Verify it is a valid PNG by checking the PNG magic bytes
      assert.ok(
        fileBuffer.length >= 8 &&
          fileBuffer[0] === 0x89 &&
          fileBuffer[1] === 0x50 &&
          fileBuffer[2] === 0x4e &&
          fileBuffer[3] === 0x47,
        `Icon file is not a valid PNG: ${icon.src}`,
      );
    }
  });

  it('each icon file has the dimensions declared in the manifest', async () => {
    const source = await readFile(manifestPath, 'utf8');
    const manifest = JSON.parse(source);

    for (const icon of manifest.icons) {
      const [declaredWidth, declaredHeight] = icon.sizes.split('x').map(Number);
      const relativePath = icon.src.replace(/^\//, '');
      const filePath = resolve(rootDir, 'src', 'client', 'public', relativePath);

      const metadata = await sharp(filePath).metadata();

      assert.equal(
        metadata.width,
        declaredWidth,
        `Icon ${icon.src}: expected width ${declaredWidth}px, got ${metadata.width}px`,
      );
      assert.equal(
        metadata.height,
        declaredHeight,
        `Icon ${icon.src}: expected height ${declaredHeight}px, got ${metadata.height}px`,
      );
    }
  });

  it('apple-touch-icon.png exists at 180x180', async () => {
    const filePath = resolve(iconsDir, 'apple-touch-icon.png');
    const metadata = await sharp(filePath).metadata();

    assert.equal(metadata.width, 180, 'apple-touch-icon.png must be 180px wide');
    assert.equal(metadata.height, 180, 'apple-touch-icon.png must be 180px tall');
    assert.equal(metadata.format, 'png', 'apple-touch-icon.png must be PNG format');
  });
});
