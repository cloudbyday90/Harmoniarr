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

import { readonly, ref } from 'vue';
import { fetchMyPreferences, updateMyPreferences } from '../lib/account-preferences-api.js';

// ── Module-level shared state ─────────────────────────────────────────────────

/** Current preferences object. Defaults match server normalisation. */
const _preferences = ref({ preferredFormat: 'any', minimumQuality: 'any' });

/** True while a load or save operation is in flight. */
const _isLoading = ref(false);

/** Last error message from a load or save, or null when no error. */
const _errorMessage = ref(null);

/** True once preferences have been loaded at least once. */
let _loaded = false;

// ── Exported reset for test isolation ────────────────────────────────────────

export function _resetAccountPreferencesState() {
  _preferences.value = { preferredFormat: 'any', minimumQuality: 'any' };
  _isLoading.value = false;
  _errorMessage.value = null;
  _loaded = false;
}

// ── Composable ────────────────────────────────────────────────────────────────

/**
 * Vue composable for per-user format/quality preferences.
 *
 * Shares state across all component instances (module-level refs). Preferences
 * are loaded on-demand via `loadPreferences()` and saved via `savePreferences()`.
 *
 * @param {object} [opts]
 * @param {function} [opts.fetchMyPreferencesFn] - Injectable API call.
 * @param {function} [opts.updateMyPreferencesFn] - Injectable API call.
 * @returns {{ preferences, isLoading, errorMessage, loadPreferences, savePreferences }}
 */
export function useAccountPreferences({
  fetchMyPreferencesFn = fetchMyPreferences,
  updateMyPreferencesFn = updateMyPreferences,
} = {}) {
  /**
   * Load preferences from the server. Safe to call multiple times — only
   * makes a network request on the first call unless `force` is true.
   *
   * @param {object} [options]
   * @param {boolean} [options.force=false] - Re-fetch even if already loaded.
   */
  async function loadPreferences({ force = false } = {}) {
    if (_loaded && !force) return;
    if (_isLoading.value) return;

    _isLoading.value = true;
    _errorMessage.value = null;

    try {
      const result = await fetchMyPreferencesFn();
      _preferences.value = result.preferences;
      _loaded = true;
    } catch (error) {
      _errorMessage.value = error?.message ?? 'Failed to load preferences.';
    } finally {
      _isLoading.value = false;
    }
  }

  /**
   * Persist a preference patch to the server and update local state on success.
   *
   * @param {object} patch - Partial preferences object.
   * @param {string} [patch.preferredFormat]
   * @param {string} [patch.minimumQuality]
   */
  async function savePreferences(patch) {
    if (_isLoading.value) return;

    _isLoading.value = true;
    _errorMessage.value = null;

    try {
      const result = await updateMyPreferencesFn(patch);
      _preferences.value = result.preferences;
    } catch (error) {
      _errorMessage.value = error?.message ?? 'Failed to save preferences.';
    } finally {
      _isLoading.value = false;
    }
  }

  return {
    errorMessage: readonly(_errorMessage),
    isLoading: readonly(_isLoading),
    loadPreferences,
    preferences: readonly(_preferences),
    savePreferences,
  };
}
