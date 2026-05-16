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

/**
 * Generate PNG icons for the PWA manifest from the SVG source icon.
 *
 * Produces:
 *   src/client/public/icons/icon-192.png        — standard install icon (Android/Chrome)
 *   src/client/public/icons/icon-512.png        — large icon (splash screens, store listing)
 *   src/client/public/icons/icon-maskable-512.png — maskable icon for Android adaptive icons
 *   src/client/public/icons/apple-touch-icon.png  — 180×180 for iOS "Add to Home Screen"
 *
 * Usage: node scripts/generate-pwa-icons.js
 *
 * Icons are committed to source so the build pipeline has no runtime dependency on sharp.
 * Re-run this script if the SVG source changes.
 */

import { readFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const rootDir = resolve(fileURLToPath(import.meta.url), '..', '..');
const svgPath = resolve(rootDir, 'src', 'client', 'assets', 'harmoniarr-icon.svg');
const badgeSvgPath = resolve(rootDir, 'src', 'client', 'assets', 'harmoniarr-badge.svg');
const outputDir = resolve(rootDir, 'src', 'client', 'public', 'icons');

/**
 * Icon specifications.  Each entry describes one output file.
 *
 * `purpose` is informational only (not written into the PNG); the manifest
 * references the correct file for each purpose.
 */
const ICON_SPECS = [
  { filename: 'icon-192.png', size: 192, purpose: 'any', source: svgPath },
  { filename: 'icon-512.png', size: 512, purpose: 'any', source: svgPath },
  { filename: 'icon-maskable-512.png', size: 512, purpose: 'maskable', source: svgPath },
  { filename: 'apple-touch-icon.png', size: 180, purpose: 'apple', source: svgPath },
  { filename: 'badge-96.png', size: 96, purpose: 'badge', source: badgeSvgPath },
];

/**
 * Render one PNG icon from the SVG source at the requested square size.
 *
 * @param {Buffer} svgBuffer - Raw SVG bytes.
 * @param {string} outputPath - Absolute output path.
 * @param {number} size - Target width and height in pixels.
 */
async function renderIcon(svgBuffer, outputPath, size) {
  await sharp(svgBuffer, { density: Math.ceil((size / 400) * 72 * 4) })
    .resize(size, size, { fit: 'fill' })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(outputPath);
}

async function main() {
  await mkdir(outputDir, { recursive: true });

  for (const spec of ICON_SPECS) {
    const svgBuffer = await readFile(spec.source);
    const outputPath = resolve(outputDir, spec.filename);
    await renderIcon(svgBuffer, outputPath, spec.size);
    console.log(`  ✓ ${spec.filename} (${spec.size}×${spec.size}, purpose=${spec.purpose})`);
  }

  console.log(`\nPWA icons written to: src/client/public/icons/`);
}

await main();
