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

import { computed, ref } from 'vue';
import {
  buildMetadataProviderCacheBaselineComparison,
  createMetadataProviderCacheBaselineComparisonSnapshot,
} from '../lib/metadata-provider-cache-baseline-comparison.js';

/**
 * Holds one explicit comparison start only for the lifetime of the active
 * Metadata view. It deliberately has no browser or server persistence.
 */
export function useMetadataProviderCacheBaselineComparison(cacheBaseline) {
  const comparisonStart = ref(null);
  const baselineComparison = computed(() => buildMetadataProviderCacheBaselineComparison(
    comparisonStart.value,
    cacheBaseline.value,
  ));
  const hasComparisonStart = computed(() => comparisonStart.value !== null);

  function clearComparisonStart() {
    comparisonStart.value = null;
  }

  function markComparisonStart() {
    const snapshot = createMetadataProviderCacheBaselineComparisonSnapshot(cacheBaseline.value);
    if (!snapshot) {
      return false;
    }

    comparisonStart.value = snapshot;
    return true;
  }

  return {
    baselineComparison,
    clearComparisonStart,
    hasComparisonStart,
    markComparisonStart,
  };
}
