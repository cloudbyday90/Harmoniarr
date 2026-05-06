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
import { ref } from 'vue';
import { useArtworkColor } from '../../src/client/composables/useArtworkColor.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NULL_COLOR = { hue: null, chroma: null, lightness: null };

function vibrantColor(overrides = {}) {
  return { hue: 180, chroma: 0.25, lightness: 0.55, ...overrides };
}

/**
 * Create a no-op extractColorFn that resolves to a vibrant color.
 * Can be used to verify that extraction is or is not triggered.
 */
function createExtractFn(result = vibrantColor(), t = null) {
  const fn = t
    ? t.mock.fn(async () => result)
    : async () => result;
  return fn;
}

// ---------------------------------------------------------------------------
// Server-side dominantColor propagation (runs outside component context)
// ---------------------------------------------------------------------------

test('useArtworkColor sets accent from a plain-object dominantColor immediately', () => {
  const imgElRef = ref(null);
  const color = vibrantColor();

  const { accent } = useArtworkColor(imgElRef, {
    dominantColor: color,
    extractColorFn: createExtractFn(NULL_COLOR),
    patchFn: async () => {},
  });

  assert.deepEqual(accent.value, { hue: color.hue, chroma: color.chroma, lightness: color.lightness });
});

test('useArtworkColor sets accent from a ref<dominantColor> immediately', () => {
  const imgElRef = ref(null);
  const dominantColor = ref(vibrantColor());

  const { accent } = useArtworkColor(imgElRef, {
    dominantColor,
    extractColorFn: createExtractFn(NULL_COLOR),
    patchFn: async () => {},
  });

  assert.deepEqual(accent.value, { hue: 180, chroma: 0.25, lightness: 0.55 });
});

test('useArtworkColor leaves accent null when dominantColor is null', () => {
  const imgElRef = ref(null);

  const { accent } = useArtworkColor(imgElRef, {
    dominantColor: null,
    extractColorFn: createExtractFn(NULL_COLOR),
    patchFn: async () => {},
  });

  assert.equal(accent.value, null);
});

test('useArtworkColor leaves accent null when dominantColor ref is null', () => {
  const imgElRef = ref(null);
  const dominantColor = ref(null);

  const { accent } = useArtworkColor(imgElRef, {
    dominantColor,
    extractColorFn: createExtractFn(NULL_COLOR),
    patchFn: async () => {},
  });

  assert.equal(accent.value, null);
});

test('useArtworkColor leaves accent null when dominantColor has null hue', () => {
  const imgElRef = ref(null);

  const { accent } = useArtworkColor(imgElRef, {
    dominantColor: { hue: null, chroma: 0.2, lightness: 0.5 },
    extractColorFn: createExtractFn(NULL_COLOR),
    patchFn: async () => {},
  });

  assert.equal(accent.value, null);
});

test('useArtworkColor updates accent reactively when dominantColor ref changes', async () => {
  const imgElRef = ref(null);
  const dominantColor = ref(null);

  const { accent } = useArtworkColor(imgElRef, {
    dominantColor,
    extractColorFn: createExtractFn(NULL_COLOR),
    patchFn: async () => {},
  });

  assert.equal(accent.value, null);

  dominantColor.value = vibrantColor({ hue: 90 });

  // Vue watch with flush: 'pre' re-runs asynchronously — await a microtask
  await Promise.resolve();

  assert.deepEqual(accent.value, { hue: 90, chroma: 0.25, lightness: 0.55 });
});

test('useArtworkColor returns { accent } as its only returned field', () => {
  const imgElRef = ref(null);
  const result = useArtworkColor(imgElRef, {
    dominantColor: null,
    extractColorFn: createExtractFn(NULL_COLOR),
    patchFn: async () => {},
  });

  assert.ok('accent' in result);
  assert.equal(Object.keys(result).length, 1);
});

// ---------------------------------------------------------------------------
// Extraction path — tested via direct extraction without DOM/component watch
// (getCurrentInstance() is null outside a Vue component, so imgElRef watch
//  is not registered here; extraction is unit-tested by calling the logic
//  directly through a composable with custom extractColorFn / patchFn)
// ---------------------------------------------------------------------------

test('useArtworkColor patchFn is not called when dominantColor is already present', async (t) => {
  const imgElRef = ref(null);
  const patchFn = t.mock.fn(async () => {});

  useArtworkColor(imgElRef, {
    dominantColor: vibrantColor(),
    artworkAssetId: 'asset-1',
    extractColorFn: createExtractFn(vibrantColor({ hue: 200 })),
    patchFn,
  });

  // Even after a tick, patchFn should not have been called — the server-side
  // dominantColor takes precedence and extraction is skipped.
  await Promise.resolve();
  assert.equal(patchFn.mock.callCount(), 0);
});

test('useArtworkColor accepts all options without throwing', () => {
  const imgElRef = ref(null);
  assert.doesNotThrow(() => {
    useArtworkColor(imgElRef, {
      dominantColor: vibrantColor(),
      isSameOriginFn: () => true,
      artworkAssetId: 'asset-42',
      extractColorFn: createExtractFn(),
      patchFn: async () => {},
    });
  });
});

test('useArtworkColor can be called with no options (uses defaults)', () => {
  const imgElRef = ref(null);
  // Should not throw even though defaults reference browser globals
  assert.doesNotThrow(() => {
    useArtworkColor(imgElRef);
  });
});
