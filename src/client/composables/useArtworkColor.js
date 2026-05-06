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

import { computed, getCurrentInstance, isRef, ref, watch } from 'vue';
import { extractDominantColor as defaultExtractColorFn } from '../lib/artwork-color-worker-client.js';
import { patchArtworkDominantColor as defaultPatchFn } from '../lib/artwork-api.js';

/**
 * Resolve a value that may be a ref, computed, or a plain value.
 */
function resolveValue(maybeRef) {
  return isRef(maybeRef) ? maybeRef.value : maybeRef;
}

/**
 * useArtworkColor — derive and persist the dominant OKLCH accent color for an artwork image.
 *
 * Priority:
 *   1. `dominantColor` prop is non-null → apply immediately (no worker).
 *   2. `isSameOriginFn()` returns false → skip extraction (cross-origin CORS would fail).
 *   3. `prefers-reduced-motion` is set → skip worker (still apply static server-side value).
 *   4. Worker extracts color → set accent, fire write-back (fire-and-forget).
 *
 * @param {import('vue').Ref<HTMLImageElement|null>} imgElRef
 * @param {{
 *   dominantColor?: import('vue').Ref|object|null,
 *   isSameOriginFn?: (() => boolean)|null,
 *   artworkAssetId?: import('vue').Ref|string|null,
 *   extractColorFn?: (imgEl: HTMLImageElement) => Promise<{hue,chroma,lightness}>,
 *   patchFn?: (assetId: string, color: object) => Promise<void>,
 * }} options
 * @returns {{ accent: import('vue').Ref<{hue,chroma,lightness}|null> }}
 */
export function useArtworkColor(imgElRef, {
  dominantColor = null,
  isSameOriginFn = null,
  artworkAssetId = null,
  extractColorFn = defaultExtractColorFn,
  patchFn = defaultPatchFn,
} = {}) {
  const accent = ref(null);

  const resolvedDominantColor = computed(() => resolveValue(dominantColor));
  const resolvedAssetId = computed(() => resolveValue(artworkAssetId));

  // Apply server-side value immediately when available (no worker needed).
  watch(
    resolvedDominantColor,
    (color) => {
      if (color && color.hue !== null && color.hue !== undefined) {
        accent.value = { hue: color.hue, chroma: color.chroma, lightness: color.lightness };
      }
    },
    { immediate: true },
  );

  function prefersReducedMotion() {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  async function tryExtract(el) {
    // Skip if server-side color is already present
    if (resolvedDominantColor.value?.hue !== null && resolvedDominantColor.value?.hue !== undefined) {
      return;
    }

    // Skip cross-origin images (Canvas would taint)
    if (isSameOriginFn && !isSameOriginFn()) return;

    // Skip if user prefers reduced motion (static server value still applied via watch above)
    if (prefersReducedMotion()) return;

    const result = await extractColorFn(el).catch(() => null);
    if (!result || result.hue === null) return;

    accent.value = { hue: result.hue, chroma: result.chroma, lightness: result.lightness };

    // Fire-and-forget write-back — never surfaces errors to the user
    const assetId = resolvedAssetId.value;
    if (assetId) {
      patchFn(assetId, result).catch(() => {});
    }
  }

  // Only attach watchers inside a component instance
  if (getCurrentInstance()) {
    watch(
      imgElRef,
      (el) => {
        if (!el) return;

        if (el.complete && el.naturalWidth > 0) {
          tryExtract(el);
        } else {
          const onLoad = () => {
            el.removeEventListener('load', onLoad);
            tryExtract(el);
          };
          el.addEventListener('load', onLoad);
        }
      },
      { immediate: true },
    );
  }

  return { accent };
}
