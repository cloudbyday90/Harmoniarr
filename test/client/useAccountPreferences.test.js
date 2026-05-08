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
import { describe, it, beforeEach } from 'node:test';
import { useAccountPreferences, _resetAccountPreferencesState } from '../../src/client/composables/useAccountPreferences.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePrefs(overrides = {}) {
  return { preferredFormat: 'any', minimumQuality: 'any', ...overrides };
}

function makeFetchFn(preferences = makePrefs()) {
  return async () => ({ ok: true, preferences });
}

function makeUpdateFn(preferences = makePrefs()) {
  return async () => ({ ok: true, preferences });
}

beforeEach(() => {
  _resetAccountPreferencesState();
});

// ── initial state ─────────────────────────────────────────────────────────────

describe('useAccountPreferences: initial state', () => {
  it('preferences defaults to any/any before load', () => {
    const { preferences } = useAccountPreferences({
      fetchMyPreferencesFn: makeFetchFn(),
      updateMyPreferencesFn: makeUpdateFn(),
    });
    assert.deepEqual(preferences.value, { preferredFormat: 'any', minimumQuality: 'any' });
  });

  it('isLoading is false before any operation', () => {
    const { isLoading } = useAccountPreferences({
      fetchMyPreferencesFn: makeFetchFn(),
      updateMyPreferencesFn: makeUpdateFn(),
    });
    assert.equal(isLoading.value, false);
  });

  it('errorMessage is null before any operation', () => {
    const { errorMessage } = useAccountPreferences({
      fetchMyPreferencesFn: makeFetchFn(),
      updateMyPreferencesFn: makeUpdateFn(),
    });
    assert.equal(errorMessage.value, null);
  });
});

// ── loadPreferences ───────────────────────────────────────────────────────────

describe('useAccountPreferences: loadPreferences', () => {
  it('updates preferences from the server response', async () => {
    const { preferences, loadPreferences } = useAccountPreferences({
      fetchMyPreferencesFn: makeFetchFn(makePrefs({ preferredFormat: 'flac', minimumQuality: 'lossless' })),
      updateMyPreferencesFn: makeUpdateFn(),
    });

    await loadPreferences();

    assert.deepEqual(preferences.value, { preferredFormat: 'flac', minimumQuality: 'lossless' });
  });

  it('isLoading is false after successful load', async () => {
    const { isLoading, loadPreferences } = useAccountPreferences({
      fetchMyPreferencesFn: makeFetchFn(),
      updateMyPreferencesFn: makeUpdateFn(),
    });

    await loadPreferences();

    assert.equal(isLoading.value, false);
  });

  it('does not call fetchFn a second time if already loaded', async () => {
    let callCount = 0;
    const fetchFn = async () => {
      callCount++;
      return { ok: true, preferences: makePrefs() };
    };
    const { loadPreferences } = useAccountPreferences({
      fetchMyPreferencesFn: fetchFn,
      updateMyPreferencesFn: makeUpdateFn(),
    });

    await loadPreferences();
    await loadPreferences();

    assert.equal(callCount, 1);
  });

  it('re-fetches when force=true', async () => {
    let callCount = 0;
    const fetchFn = async () => {
      callCount++;
      return { ok: true, preferences: makePrefs() };
    };
    const { loadPreferences } = useAccountPreferences({
      fetchMyPreferencesFn: fetchFn,
      updateMyPreferencesFn: makeUpdateFn(),
    });

    await loadPreferences();
    await loadPreferences({ force: true });

    assert.equal(callCount, 2);
  });

  it('sets errorMessage on fetch failure', async () => {
    const { errorMessage, loadPreferences } = useAccountPreferences({
      fetchMyPreferencesFn: async () => { throw new Error('network error'); },
      updateMyPreferencesFn: makeUpdateFn(),
    });

    await loadPreferences();

    assert.equal(errorMessage.value, 'network error');
  });

  it('isLoading is false after failed load', async () => {
    const { isLoading, loadPreferences } = useAccountPreferences({
      fetchMyPreferencesFn: async () => { throw new Error('fail'); },
      updateMyPreferencesFn: makeUpdateFn(),
    });

    await loadPreferences();

    assert.equal(isLoading.value, false);
  });

  it('clears errorMessage on a subsequent successful load', async () => {
    let attempt = 0;
    const fetchFn = async () => {
      attempt++;
      if (attempt === 1) throw new Error('first attempt fails');
      return { ok: true, preferences: makePrefs() };
    };
    const { errorMessage, loadPreferences } = useAccountPreferences({
      fetchMyPreferencesFn: fetchFn,
      updateMyPreferencesFn: makeUpdateFn(),
    });

    await loadPreferences();
    assert.equal(errorMessage.value, 'first attempt fails');

    await loadPreferences({ force: true });
    assert.equal(errorMessage.value, null);
  });
});

// ── savePreferences ───────────────────────────────────────────────────────────

describe('useAccountPreferences: savePreferences', () => {
  it('updates preferences from the server response', async () => {
    const { preferences, loadPreferences, savePreferences } = useAccountPreferences({
      fetchMyPreferencesFn: makeFetchFn(),
      updateMyPreferencesFn: makeUpdateFn(makePrefs({ preferredFormat: 'mp3_320', minimumQuality: 'high' })),
    });

    await loadPreferences();
    await savePreferences({ preferredFormat: 'mp3_320', minimumQuality: 'high' });

    assert.deepEqual(preferences.value, { preferredFormat: 'mp3_320', minimumQuality: 'high' });
  });

  it('passes patch to the update function', async () => {
    const calls = [];
    const updateFn = async (patch) => {
      calls.push(patch);
      return { ok: true, preferences: makePrefs() };
    };
    const { savePreferences } = useAccountPreferences({
      fetchMyPreferencesFn: makeFetchFn(),
      updateMyPreferencesFn: updateFn,
    });

    await savePreferences({ preferredFormat: 'flac' });

    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], { preferredFormat: 'flac' });
  });

  it('isLoading is false after successful save', async () => {
    const { isLoading, savePreferences } = useAccountPreferences({
      fetchMyPreferencesFn: makeFetchFn(),
      updateMyPreferencesFn: makeUpdateFn(),
    });

    await savePreferences({ preferredFormat: 'any' });

    assert.equal(isLoading.value, false);
  });

  it('sets errorMessage on save failure', async () => {
    const { errorMessage, savePreferences } = useAccountPreferences({
      fetchMyPreferencesFn: makeFetchFn(),
      updateMyPreferencesFn: async () => { throw new Error('save failed'); },
    });

    await savePreferences({ preferredFormat: 'flac' });

    assert.equal(errorMessage.value, 'save failed');
  });

  it('isLoading is false after failed save', async () => {
    const { isLoading, savePreferences } = useAccountPreferences({
      fetchMyPreferencesFn: makeFetchFn(),
      updateMyPreferencesFn: async () => { throw new Error('fail'); },
    });

    await savePreferences({ minimumQuality: 'lossless' });

    assert.equal(isLoading.value, false);
  });

  it('clears errorMessage on a subsequent successful save', async () => {
    let attempt = 0;
    const updateFn = async () => {
      attempt++;
      if (attempt === 1) throw new Error('first save fails');
      return { ok: true, preferences: makePrefs() };
    };
    const { errorMessage, savePreferences } = useAccountPreferences({
      fetchMyPreferencesFn: makeFetchFn(),
      updateMyPreferencesFn: updateFn,
    });

    await savePreferences({ preferredFormat: 'flac' });
    assert.equal(errorMessage.value, 'first save fails');

    await savePreferences({ preferredFormat: 'any' });
    assert.equal(errorMessage.value, null);
  });
});

// ── _resetAccountPreferencesState ─────────────────────────────────────────────

describe('_resetAccountPreferencesState', () => {
  it('restores default preferences after a load', async () => {
    const { preferences, loadPreferences } = useAccountPreferences({
      fetchMyPreferencesFn: makeFetchFn(makePrefs({ preferredFormat: 'flac' })),
      updateMyPreferencesFn: makeUpdateFn(),
    });

    await loadPreferences();
    assert.equal(preferences.value.preferredFormat, 'flac');

    _resetAccountPreferencesState();
    assert.deepEqual(preferences.value, { preferredFormat: 'any', minimumQuality: 'any' });
  });

  it('forces a re-fetch after reset', async () => {
    let callCount = 0;
    const fetchFn = async () => {
      callCount++;
      return { ok: true, preferences: makePrefs() };
    };
    const { loadPreferences } = useAccountPreferences({
      fetchMyPreferencesFn: fetchFn,
      updateMyPreferencesFn: makeUpdateFn(),
    });

    await loadPreferences();
    _resetAccountPreferencesState();
    await loadPreferences();

    assert.equal(callCount, 2);
  });
});
