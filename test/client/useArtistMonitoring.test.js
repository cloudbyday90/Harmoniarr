import assert from 'node:assert/strict';
import test from 'node:test';
import { useArtistMonitoring } from '../../src/client/composables/useArtistMonitoring.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createToastDouble(t) {
  return {
    success: t.mock.fn(),
    error: t.mock.fn(),
    info: t.mock.fn(),
    warning: t.mock.fn(),
    dismiss: t.mock.fn(),
  };
}

function createImportDouble({ artistId = 'local-artist-1' } = {}) {
  return async () => ({
    ok: true,
    imported: { artistId, source: 'musicbrainz' },
  });
}

function createMonitorDouble() {
  return async () => ({ ok: true });
}

function createOperatorSaveDouble() {
  return async () => ({ ok: true, reconciliation: { accepted: true } });
}

// ---------------------------------------------------------------------------
// monitorArtist — happy path
// ---------------------------------------------------------------------------

test('useArtistMonitoring monitorArtist passes the MusicBrainz artist ID to importArtist', async (t) => {
  const importArtist = t.mock.fn(createImportDouble());
  const toast = createToastDouble(t);
  const { monitorArtist } = useArtistMonitoring({
    importArtist,
    updateMonitoring: createMonitorDouble(),
    toast,
  });

  await monitorArtist({ id: 'mb-artist-42', name: 'Boards of Canada' });

  assert.equal(importArtist.mock.callCount(), 1);
  assert.equal(importArtist.mock.calls[0].arguments[0], 'mb-artist-42');
});

test('useArtistMonitoring monitorArtist passes imported.artistId — not artist.id — to updateMonitoring', async (t) => {
  const updateMonitoring = t.mock.fn(createMonitorDouble());
  const toast = createToastDouble(t);
  const { monitorArtist } = useArtistMonitoring({
    importArtist: async () => ({
      ok: true,
      imported: { artistId: 'local-99', source: 'musicbrainz' },
    }),
    updateMonitoring,
    toast,
  });

  await monitorArtist({ id: 'mb-artist-42', name: 'Autechre' });

  assert.equal(updateMonitoring.mock.callCount(), 1);
  assert.equal(updateMonitoring.mock.calls[0].arguments[0], 'local-99');
});

test('useArtistMonitoring monitorArtist moves artist to monitoredIds and emits toast on success', async (t) => {
  const toast = createToastDouble(t);
  const { monitoredIds, monitoringIds, isMonitored, hasMonitored, monitorArtist } = useArtistMonitoring({
    importArtist: createImportDouble({ artistId: 'local-1' }),
    updateMonitoring: createMonitorDouble(),
    toast,
  });

  await monitorArtist({ id: 'mb-1', name: 'Portishead' });

  assert.equal(monitoredIds.value.has('mb-1'), true);
  assert.equal(monitoringIds.value.has('mb-1'), false);
  assert.equal(isMonitored('mb-1'), true);
  assert.equal(hasMonitored.value, true);
  assert.equal(toast.success.mock.callCount(), 1);
  assert.match(toast.success.mock.calls[0].arguments[0], /Portishead/);
});

test('useArtistMonitoring monitorArtist returns success result', async (t) => {
  const toast = createToastDouble(t);
  const { monitorArtist } = useArtistMonitoring({
    importArtist: createImportDouble(),
    updateMonitoring: createMonitorDouble(),
    toast,
  });

  const result = await monitorArtist({ id: 'mb-ok', name: 'OK Artist' });
  assert.equal(result.success, true);
});

// ---------------------------------------------------------------------------
// monitorArtist — regression: missing imported.artistId must be an error
// ---------------------------------------------------------------------------

test('useArtistMonitoring monitorArtist treats a missing imported.artistId as an error and does not call updateMonitoring', async (t) => {
  const updateMonitoring = t.mock.fn();
  const toast = createToastDouble(t);
  const { monitoredIds, hasMonitored, monitorArtist } = useArtistMonitoring({
    importArtist: async () => ({ ok: true, imported: { source: 'musicbrainz' } }), // no artistId
    updateMonitoring,
    toast,
  });

  const result = await monitorArtist({ id: 'mb-broken', name: 'Unknown Artist' });

  assert.equal(result.success, false);
  assert.equal(monitoredIds.value.has('mb-broken'), false);
  assert.equal(hasMonitored.value, false);
  assert.equal(updateMonitoring.mock.callCount(), 0);
  assert.equal(toast.success.mock.callCount(), 0);
  assert.equal(toast.error.mock.callCount(), 1);
});

test('useArtistMonitoring monitorArtist treats a null imported response as an error and does not call updateMonitoring', async (t) => {
  const updateMonitoring = t.mock.fn();
  const toast = createToastDouble(t);
  const { monitoredIds, monitorArtist } = useArtistMonitoring({
    importArtist: async () => null,
    updateMonitoring,
    toast,
  });

  const result = await monitorArtist({ id: 'mb-null', name: 'Null Artist' });

  assert.equal(result.success, false);
  assert.equal(monitoredIds.value.has('mb-null'), false);
  assert.equal(updateMonitoring.mock.callCount(), 0);
  assert.equal(toast.error.mock.callCount(), 1);
});

// ---------------------------------------------------------------------------
// monitorArtist — failure paths
// ---------------------------------------------------------------------------

test('useArtistMonitoring monitorArtist sets error result when importArtist throws', async (t) => {
  const toast = createToastDouble(t);
  const { monitoredIds, hasMonitored, monitorArtist } = useArtistMonitoring({
    importArtist: async () => { throw new Error('import service unavailable'); },
    updateMonitoring: createMonitorDouble(),
    toast,
  });

  const result = await monitorArtist({ id: 'mb-err', name: 'Failure Artist' });

  assert.equal(result.success, false);
  assert.match(result.error.message, /import service unavailable/);
  assert.equal(monitoredIds.value.has('mb-err'), false);
  assert.equal(hasMonitored.value, false);
  assert.equal(toast.error.mock.callCount(), 1);
  assert.match(toast.error.mock.calls[0].arguments[0], /import service unavailable/);
});

test('useArtistMonitoring monitorArtist sets error result when updateMonitoring throws', async (t) => {
  const toast = createToastDouble(t);
  const { monitoredIds, hasMonitored, monitorArtist } = useArtistMonitoring({
    importArtist: createImportDouble({ artistId: 'local-1' }),
    updateMonitoring: async () => { throw new Error('monitoring update failed'); },
    toast,
  });

  const result = await monitorArtist({ id: 'mb-fail', name: 'Monitor Fail' });

  assert.equal(result.success, false);
  assert.equal(monitoredIds.value.has('mb-fail'), false);
  assert.equal(hasMonitored.value, false);
  assert.equal(toast.error.mock.callCount(), 1);
  assert.match(toast.error.mock.calls[0].arguments[0], /monitoring update failed/);
});

// ---------------------------------------------------------------------------
// monitorArtist — idempotency and per-card independence
// ---------------------------------------------------------------------------

test('useArtistMonitoring monitorArtist is a no-op when the artist is already being monitored', async (t) => {
  const importArtist = t.mock.fn(createImportDouble());
  const toast = createToastDouble(t);
  const { monitoringIds, monitorArtist } = useArtistMonitoring({
    importArtist,
    updateMonitoring: createMonitorDouble(),
    toast,
  });

  // Seed monitoringIds with a pre-existing in-progress entry.
  monitoringIds.value = new Set(['mb-1']);
  const result = await monitorArtist({ id: 'mb-1', name: 'Double Monitor' });

  assert.equal(result.success, false);
  assert.equal(importArtist.mock.callCount(), 0);
});

test('useArtistMonitoring monitorArtist is a no-op when the artist is already monitored', async (t) => {
  const importArtist = t.mock.fn(createImportDouble());
  const toast = createToastDouble(t);
  const { monitorArtist } = useArtistMonitoring({
    importArtist,
    updateMonitoring: createMonitorDouble(),
    initialMonitoredIds: ['mb-1'],
    toast,
  });

  const result = await monitorArtist({ id: 'mb-1', name: 'Already Monitored' });

  assert.equal(result.success, false);
  assert.equal(importArtist.mock.callCount(), 0);
});

test('useArtistMonitoring monitorArtist tracks state per artist independently', async (t) => {
  const toast = createToastDouble(t);
  const { monitoredIds, hasMonitored, monitorArtist } = useArtistMonitoring({
    importArtist: createImportDouble({ artistId: 'local-x' }),
    updateMonitoring: createMonitorDouble(),
    toast,
  });

  await Promise.all([
    monitorArtist({ id: 'mb-a', name: 'Artist A' }),
    monitorArtist({ id: 'mb-b', name: 'Artist B' }),
  ]);

  assert.equal(monitoredIds.value.has('mb-a'), true);
  assert.equal(monitoredIds.value.has('mb-b'), true);
  assert.equal(hasMonitored.value, true);
  assert.equal(toast.success.mock.callCount(), 2);
});

// ---------------------------------------------------------------------------
// hasMonitored computed
// ---------------------------------------------------------------------------

test('useArtistMonitoring hasMonitored is false initially and becomes true after the first successful monitor', async (t) => {
  const toast = createToastDouble(t);
  const { hasMonitored, monitorArtist } = useArtistMonitoring({
    importArtist: createImportDouble(),
    updateMonitoring: createMonitorDouble(),
    toast,
  });

  assert.equal(hasMonitored.value, false);

  await monitorArtist({ id: 'mb-first', name: 'First Artist' });

  assert.equal(hasMonitored.value, true);
});

test('useArtistMonitoring hasMonitored remains false when every monitor attempt fails', async (t) => {
  const toast = createToastDouble(t);
  const { hasMonitored, monitorArtist } = useArtistMonitoring({
    importArtist: async () => { throw new Error('fail'); },
    updateMonitoring: createMonitorDouble(),
    toast,
  });

  await monitorArtist({ id: 'mb-bad', name: 'Bad Artist' });

  assert.equal(hasMonitored.value, false);
});

// ---------------------------------------------------------------------------
// initialMonitoredIds option
// ---------------------------------------------------------------------------

test('useArtistMonitoring initialMonitoredIds pre-populates monitoredIds', (t) => {
  const toast = createToastDouble(t);
  const { isMonitored, hasMonitored } = useArtistMonitoring({
    initialMonitoredIds: ['mb-seed-1', 'mb-seed-2'],
    toast,
  });

  assert.equal(isMonitored('mb-seed-1'), true);
  assert.equal(isMonitored('mb-seed-2'), true);
  assert.equal(isMonitored('mb-unknown'), false);
  assert.equal(hasMonitored.value, true);
});

// ---------------------------------------------------------------------------
// showToasts: false option
// ---------------------------------------------------------------------------

test('useArtistMonitoring does not call toast when showToasts is false', async (t) => {
  const toast = createToastDouble(t);
  const { monitorArtist } = useArtistMonitoring({
    importArtist: createImportDouble(),
    updateMonitoring: createMonitorDouble(),
    showToasts: false,
    toast,
  });

  await monitorArtist({ id: 'mb-quiet', name: 'Quiet Artist' });

  assert.equal(toast.success.mock.callCount(), 0);
  assert.equal(toast.error.mock.callCount(), 0);
});

test('useArtistMonitoring does not call toast on error when showToasts is false', async (t) => {
  const toast = createToastDouble(t);
  const { monitorArtist } = useArtistMonitoring({
    importArtist: async () => { throw new Error('silent fail'); },
    updateMonitoring: createMonitorDouble(),
    showToasts: false,
    toast,
  });

  await monitorArtist({ id: 'mb-quiet-err', name: 'Quiet Error Artist' });

  assert.equal(toast.error.mock.callCount(), 0);
});

// ---------------------------------------------------------------------------
// isMonitoring helper
// ---------------------------------------------------------------------------

test('useArtistMonitoring isMonitoring reflects in-progress Set membership', async (t) => {
  const toast = createToastDouble(t);
  const inProgressChecked = { value: false };

  // Use a slow import to observe the in-progress state.
  const importArtist = () => new Promise((resolve) => {
    setImmediate(() => resolve({
      ok: true,
      imported: { artistId: 'local-1', source: 'musicbrainz' },
    }));
  });

  const { isMonitoring, monitorArtist } = useArtistMonitoring({
    importArtist,
    updateMonitoring: createMonitorDouble(),
    toast,
  });

  const monitorPromise = monitorArtist({ id: 'mb-check', name: 'Check Artist' });

  // isMonitoring should be true while the import is pending.
  inProgressChecked.value = isMonitoring('mb-check');
  await monitorPromise;

  assert.equal(inProgressChecked.value, true);
  assert.equal(isMonitoring('mb-check'), false);
});

// ---------------------------------------------------------------------------
// addArtistWithPolicy — operator-scoped add flow
// ---------------------------------------------------------------------------

test('useArtistMonitoring addArtistWithPolicy imports then saves operator draft', async (t) => {
  const importArtist = t.mock.fn(createImportDouble({ artistId: 'local-artist-77' }));
  const saveOperatorArtist = t.mock.fn(createOperatorSaveDouble());
  const toast = createToastDouble(t);
  const { addArtistWithPolicy } = useArtistMonitoring({
    importArtist,
    saveOperatorArtist,
    toast,
  });

  const result = await addArtistWithPolicy({
    id: 'mb-add-1',
    name: 'Aphex Twin',
  }, {
    monitoredReleaseGroupTypes: ['album', 'single'],
    searchNow: true,
    wantedAutomationMode: 'current_and_future_matching',
  });

  assert.equal(result.success, true);
  assert.equal(importArtist.mock.calls[0].arguments[0], 'mb-add-1');
  assert.equal(saveOperatorArtist.mock.calls[0].arguments[0], 'local-artist-77');
  assert.deepEqual(saveOperatorArtist.mock.calls[0].arguments[1], {
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

test('useArtistMonitoring addArtistWithPolicy marks the MusicBrainz artist as monitored', async (t) => {
  const toast = createToastDouble(t);
  const { addArtistWithPolicy, isMonitored, monitoredIds, monitoringIds } = useArtistMonitoring({
    importArtist: createImportDouble({ artistId: 'local-artist-2' }),
    saveOperatorArtist: createOperatorSaveDouble(),
    toast,
  });

  await addArtistWithPolicy({ id: 'mb-add-2', name: 'Stereolab' });

  assert.equal(isMonitored('mb-add-2'), true);
  assert.equal(monitoredIds.value.has('mb-add-2'), true);
  assert.equal(monitoringIds.value.has('mb-add-2'), false);
  assert.equal(toast.success.mock.callCount(), 1);
  assert.match(toast.success.mock.calls[0].arguments[0], /Stereolab/);
});

test('useArtistMonitoring addArtistWithPolicy keeps state unchanged when save fails', async (t) => {
  const toast = createToastDouble(t);
  const { addArtistWithPolicy, isMonitored, monitoringIds } = useArtistMonitoring({
    importArtist: createImportDouble({ artistId: 'local-artist-3' }),
    saveOperatorArtist: async () => {
      throw new Error('operator save failed');
    },
    toast,
  });

  const result = await addArtistWithPolicy({ id: 'mb-add-3', name: 'Failure' });

  assert.equal(result.success, false);
  assert.equal(isMonitored('mb-add-3'), false);
  assert.equal(monitoringIds.value.has('mb-add-3'), false);
  assert.equal(toast.error.mock.callCount(), 1);
  assert.match(toast.error.mock.calls[0].arguments[0], /operator save failed/);
});

test('useArtistMonitoring addArtistWithPolicy is a no-op when already monitored', async (t) => {
  const importArtist = t.mock.fn(createImportDouble());
  const toast = createToastDouble(t);
  const { addArtistWithPolicy } = useArtistMonitoring({
    importArtist,
    initialMonitoredIds: ['mb-add-known'],
    saveOperatorArtist: createOperatorSaveDouble(),
    toast,
  });

  const result = await addArtistWithPolicy({ id: 'mb-add-known', name: 'Known' });

  assert.equal(result.success, false);
  assert.equal(importArtist.mock.callCount(), 0);
});
