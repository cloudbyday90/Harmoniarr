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

import assert from 'node:assert/strict';
import test from 'node:test';
import { createArtworkDominantColorService } from '../../src/server/artwork/artwork-dominant-color-service.js';

function createStubs({ assetExists = true, patched = true } = {}) {
  return {
    getArtworkAssetByIdFn: async () => (assetExists ? { id: 'asset-1', storageNamespace: 'artwork' } : null),
    patchArtworkDominantColorFn: async () => patched,
  };
}

test('writeDominantColor returns ok:true and updated:true when asset exists and patch writes a new value', async () => {
  const service = createArtworkDominantColorService(createStubs({ assetExists: true, patched: true }));
  const result = await service.writeDominantColor({
    artworkAssetId: 'asset-1',
    hue: 180,
    chroma: 0.2,
    lightness: 0.5,
  });
  assert.deepEqual(result, { ok: true, updated: true });
});

test('writeDominantColor returns ok:true and updated:false when asset already had a color (patch noop)', async () => {
  const service = createArtworkDominantColorService(createStubs({ assetExists: true, patched: false }));
  const result = await service.writeDominantColor({
    artworkAssetId: 'asset-1',
    hue: 90,
    chroma: 0.1,
    lightness: 0.7,
  });
  assert.deepEqual(result, { ok: true, updated: false });
});

test('writeDominantColor throws 404 when the artwork asset does not exist', async () => {
  const service = createArtworkDominantColorService(createStubs({ assetExists: false }));
  await assert.rejects(
    () => service.writeDominantColor({
      artworkAssetId: 'missing-asset',
      hue: 180,
      chroma: 0.2,
      lightness: 0.5,
    }),
    { status: 404, code: 'artwork_asset_not_found' },
  );
});

test('writeDominantColor throws 422 when artworkAssetId is empty', async () => {
  const service = createArtworkDominantColorService(createStubs());
  await assert.rejects(
    () => service.writeDominantColor({ artworkAssetId: '', hue: 180, chroma: 0.2, lightness: 0.5 }),
    { status: 422 },
  );
});

test('writeDominantColor throws 422 when hue is below 0', async () => {
  const service = createArtworkDominantColorService(createStubs());
  await assert.rejects(
    () => service.writeDominantColor({ artworkAssetId: 'asset-1', hue: -1, chroma: 0.2, lightness: 0.5 }),
    { status: 422, code: 'dominant_color_invalid' },
  );
});

test('writeDominantColor throws 422 when hue exceeds 360', async () => {
  const service = createArtworkDominantColorService(createStubs());
  await assert.rejects(
    () => service.writeDominantColor({ artworkAssetId: 'asset-1', hue: 361, chroma: 0.2, lightness: 0.5 }),
    { status: 422, code: 'dominant_color_invalid' },
  );
});

test('writeDominantColor throws 422 when chroma is below 0', async () => {
  const service = createArtworkDominantColorService(createStubs());
  await assert.rejects(
    () => service.writeDominantColor({ artworkAssetId: 'asset-1', hue: 180, chroma: -0.01, lightness: 0.5 }),
    { status: 422, code: 'dominant_color_invalid' },
  );
});

test('writeDominantColor throws 422 when chroma exceeds 0.4', async () => {
  const service = createArtworkDominantColorService(createStubs());
  await assert.rejects(
    () => service.writeDominantColor({ artworkAssetId: 'asset-1', hue: 180, chroma: 0.5, lightness: 0.5 }),
    { status: 422, code: 'dominant_color_invalid' },
  );
});

test('writeDominantColor throws 422 when lightness is below 0', async () => {
  const service = createArtworkDominantColorService(createStubs());
  await assert.rejects(
    () => service.writeDominantColor({ artworkAssetId: 'asset-1', hue: 180, chroma: 0.2, lightness: -0.1 }),
    { status: 422, code: 'dominant_color_invalid' },
  );
});

test('writeDominantColor throws 422 when lightness exceeds 1', async () => {
  const service = createArtworkDominantColorService(createStubs());
  await assert.rejects(
    () => service.writeDominantColor({ artworkAssetId: 'asset-1', hue: 180, chroma: 0.2, lightness: 1.1 }),
    { status: 422, code: 'dominant_color_invalid' },
  );
});

test('writeDominantColor throws 422 when hue is NaN', async () => {
  const service = createArtworkDominantColorService(createStubs());
  await assert.rejects(
    () => service.writeDominantColor({ artworkAssetId: 'asset-1', hue: Number.NaN, chroma: 0.2, lightness: 0.5 }),
    { status: 422, code: 'dominant_color_invalid' },
  );
});

test('writeDominantColor accepts boundary values: hue=0, chroma=0, lightness=0', async () => {
  const service = createArtworkDominantColorService(createStubs({ assetExists: true, patched: true }));
  const result = await service.writeDominantColor({
    artworkAssetId: 'asset-1',
    hue: 0,
    chroma: 0,
    lightness: 0,
  });
  assert.equal(result.ok, true);
});

test('writeDominantColor accepts boundary values: hue=360, chroma=0.4, lightness=1', async () => {
  const service = createArtworkDominantColorService(createStubs({ assetExists: true, patched: true }));
  const result = await service.writeDominantColor({
    artworkAssetId: 'asset-1',
    hue: 360,
    chroma: 0.4,
    lightness: 1,
  });
  assert.equal(result.ok, true);
});
