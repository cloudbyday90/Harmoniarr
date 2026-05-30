import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildOperatorArtistDraftFromAddPolicy,
  defaultAddArtistPolicyForm,
  loadSavedAddArtistPolicyForm,
  normalizeAddArtistPolicyForm,
  saveAddArtistPolicyForm,
} from '../../src/client/lib/add-artist-policy.js';

function createStorageDouble(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    values,
  };
}

test('normalizeAddArtistPolicyForm returns first-pass defaults', () => {
  assert.deepEqual(normalizeAddArtistPolicyForm(), {
    acquisitionProfileKey: 'balanced_library',
    monitoredReleaseGroupTypes: ['album', 'ep'],
    releaseScope: 'future_only',
    searchNow: false,
    useAsDefault: true,
    wantedAutomationMode: 'future_matching',
  });
});

test('normalizeAddArtistPolicyForm de-duplicates and filters content types', () => {
  const result = normalizeAddArtistPolicyForm({
    monitoredReleaseGroupTypes: ['album', 'album', 'single', 'unsupported'],
  });

  assert.deepEqual(result.monitoredReleaseGroupTypes, ['album', 'single']);
});

test('normalizeAddArtistPolicyForm falls back when all content types are invalid', () => {
  const result = normalizeAddArtistPolicyForm({
    monitoredReleaseGroupTypes: ['unsupported'],
  });

  assert.deepEqual(result.monitoredReleaseGroupTypes, defaultAddArtistPolicyForm.monitoredReleaseGroupTypes);
});

test('buildOperatorArtistDraftFromAddPolicy maps searchNow to missing_now', () => {
  const draft = buildOperatorArtistDraftFromAddPolicy({
    monitoredReleaseGroupTypes: ['album', 'single'],
    searchNow: true,
    wantedAutomationMode: 'current_and_future_matching',
  });

  assert.deepEqual(draft, {
    monitoring: {
      acquisitionProfileKey: 'balanced_library',
      isMonitored: true,
      monitoredReleaseGroupTypes: ['album', 'single'],
      releaseScope: 'future_only',
      searchOnAddMode: 'missing_now',
      selectionSourceMode: 'policy_only',
      wantedAutomationMode: 'current_and_future_matching',
    },
    releaseGroupSelections: [],
    trackOverrides: [],
  });
});

test('buildOperatorArtistDraftFromAddPolicy maps searchNow false to none', () => {
  const draft = buildOperatorArtistDraftFromAddPolicy({ searchNow: false });

  assert.equal(draft.monitoring.searchOnAddMode, 'none');
});

test('saveAddArtistPolicyForm stores normalized policy and returns it', () => {
  const storage = createStorageDouble();
  const saved = saveAddArtistPolicyForm({
    acquisitionProfileKey: 'storage_saver',
    monitoredReleaseGroupTypes: ['live'],
    releaseScope: 'current_and_future',
    searchNow: true,
    useAsDefault: false,
    wantedAutomationMode: 'manual_only',
  }, { storage });

  const loaded = loadSavedAddArtistPolicyForm({ storage });
  assert.deepEqual(loaded, saved);
});

test('loadSavedAddArtistPolicyForm falls back on invalid stored JSON', () => {
  const storage = createStorageDouble({
    'harmoniarr:add-artist-policy:v1': '{bad json',
  });

  assert.deepEqual(loadSavedAddArtistPolicyForm({ storage }), normalizeAddArtistPolicyForm());
});
