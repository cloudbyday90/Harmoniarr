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

function createOperatorSaveDouble() {
  return async () => ({ ok: true, reconciliation: { accepted: true } });
}

// ---------------------------------------------------------------------------
// addArtistWithPolicy — happy path
// ---------------------------------------------------------------------------

test('useArtistMonitoring addArtistWithPolicy passes the MusicBrainz artist ID to importArtist', async (t) => {
  const importArtist = t.mock.fn(createImportDouble());
  const toast = createToastDouble(t);
  const { addArtistWithPolicy } = useArtistMonitoring({
    importArtist,
    saveOperatorArtist: createOperatorSaveDouble(),
    toast,
  });

  await addArtistWithPolicy({ id: 'mb-artist-42', name: 'Boards of Canada' });

  assert.equal(importArtist.mock.callCount(), 1);
  assert.equal(importArtist.mock.calls[0].arguments[0], 'mb-artist-42');
});

test('useArtistMonitoring addArtistWithPolicy passes imported.artistId — not artist.id — to saveOperatorArtist with a default draft', async (t) => {
  const saveOperatorArtist = t.mock.fn(createOperatorSaveDouble());
  const toast = createToastDouble(t);
  const { addArtistWithPolicy } = useArtistMonitoring({
    importArtist: async () => ({
      ok: true,
      imported: { artistId: 'local-99', source: 'musicbrainz' },
    }),
    saveOperatorArtist,
    toast,
  });

  await addArtistWithPolicy({ id: 'mb-artist-42', name: 'Autechre' });

  assert.equal(saveOperatorArtist.mock.callCount(), 1);
  assert.equal(saveOperatorArtist.mock.calls[0].arguments[0], 'local-99');
  assert.equal(saveOperatorArtist.mock.calls[0].arguments[1].monitoring.isMonitored, true);
});

test('useArtistMonitoring addArtistWithPolicy moves artist to monitoredIds and emits toast on success', async (t) => {
  const toast = createToastDouble(t);
  const { monitoredIds, monitoringIds, isMonitored, hasMonitored, addArtistWithPolicy } = useArtistMonitoring({
    importArtist: createImportDouble({ artistId: 'local-1' }),
    saveOperatorArtist: createOperatorSaveDouble(),
    toast,
  });

  await addArtistWithPolicy({ id: 'mb-1', name: 'Portishead' });

  assert.equal(monitoredIds.value.has('mb-1'), true);
  assert.equal(monitoringIds.value.has('mb-1'), false);
  assert.equal(isMonitored('mb-1'), true);
  assert.equal(hasMonitored.value, true);
  assert.equal(toast.success.mock.callCount(), 1);
  assert.match(toast.success.mock.calls[0].arguments[0], /Portishead/);
});

test('useArtistMonitoring addArtistWithPolicy returns success result', async (t) => {
  const toast = createToastDouble(t);
  const { addArtistWithPolicy } = useArtistMonitoring({
    importArtist: createImportDouble(),
    saveOperatorArtist: createOperatorSaveDouble(),
    toast,
  });

  const result = await addArtistWithPolicy({ id: 'mb-ok', name: 'OK Artist' });
  assert.equal(result.success, true);
});

// ---------------------------------------------------------------------------
// addArtistWithPolicy — regression: missing imported.artistId must be an error
// ---------------------------------------------------------------------------

test('useArtistMonitoring addArtistWithPolicy treats a missing imported.artistId as an error and does not call saveOperatorArtist', async (t) => {
  const saveOperatorArtist = t.mock.fn();
  const toast = createToastDouble(t);
  const { monitoredIds, hasMonitored, addArtistWithPolicy } = useArtistMonitoring({
    importArtist: async () => ({ ok: true, imported: { source: 'musicbrainz' } }), // no artistId
    saveOperatorArtist,
    toast,
  });

  const result = await addArtistWithPolicy({ id: 'mb-broken', name: 'Unknown Artist' });

  assert.equal(result.success, false);
  assert.equal(monitoredIds.value.has('mb-broken'), false);
  assert.equal(hasMonitored.value, false);
  assert.equal(saveOperatorArtist.mock.callCount(), 0);
  assert.equal(toast.success.mock.callCount(), 0);
  assert.equal(toast.error.mock.callCount(), 1);
});

test('useArtistMonitoring addArtistWithPolicy treats a null imported response as an error and does not call saveOperatorArtist', async (t) => {
  const saveOperatorArtist = t.mock.fn();
  const toast = createToastDouble(t);
  const { monitoredIds, addArtistWithPolicy } = useArtistMonitoring({
    importArtist: async () => null,
    saveOperatorArtist,
    toast,
  });

  const result = await addArtistWithPolicy({ id: 'mb-null', name: 'Null Artist' });

  assert.equal(result.success, false);
  assert.equal(monitoredIds.value.has('mb-null'), false);
  assert.equal(saveOperatorArtist.mock.callCount(), 0);
  assert.equal(toast.error.mock.callCount(), 1);
});

// ---------------------------------------------------------------------------
// addArtistWithPolicy — failure paths
// ---------------------------------------------------------------------------

test('useArtistMonitoring addArtistWithPolicy sets error result when importArtist throws', async (t) => {
  const toast = createToastDouble(t);
  const { monitoredIds, hasMonitored, addArtistWithPolicy } = useArtistMonitoring({
    importArtist: async () => { throw new Error('import service unavailable'); },
    saveOperatorArtist: createOperatorSaveDouble(),
    toast,
  });

  const result = await addArtistWithPolicy({ id: 'mb-err', name: 'Failure Artist' });

  assert.equal(result.success, false);
  assert.match(result.error.message, /import service unavailable/);
  assert.equal(monitoredIds.value.has('mb-err'), false);
  assert.equal(hasMonitored.value, false);
  assert.equal(toast.error.mock.callCount(), 1);
  assert.match(toast.error.mock.calls[0].arguments[0], /import service unavailable/);
});

test('useArtistMonitoring addArtistWithPolicy sets error result when saveOperatorArtist throws', async (t) => {
  const toast = createToastDouble(t);
  const { monitoredIds, hasMonitored, addArtistWithPolicy } = useArtistMonitoring({
    importArtist: createImportDouble({ artistId: 'local-1' }),
    saveOperatorArtist: async () => { throw new Error('operator save failed'); },
    toast,
  });

  const result = await addArtistWithPolicy({ id: 'mb-fail', name: 'Monitor Fail' });

  assert.equal(result.success, false);
  assert.equal(monitoredIds.value.has('mb-fail'), false);
  assert.equal(hasMonitored.value, false);
  assert.equal(toast.error.mock.callCount(), 1);
  assert.match(toast.error.mock.calls[0].arguments[0], /operator save failed/);
});

// ---------------------------------------------------------------------------
// addArtistWithPolicy — idempotency and per-card independence
// ---------------------------------------------------------------------------

test('useArtistMonitoring addArtistWithPolicy is a no-op when the artist is already being monitored', async (t) => {
  const importArtist = t.mock.fn(createImportDouble());
  const toast = createToastDouble(t);
  const { monitoringIds, addArtistWithPolicy } = useArtistMonitoring({
    importArtist,
    saveOperatorArtist: createOperatorSaveDouble(),
    toast,
  });

  // Seed monitoringIds with a pre-existing in-progress entry.
  monitoringIds.value = new Set(['mb-1']);
  const result = await addArtistWithPolicy({ id: 'mb-1', name: 'Double Monitor' });

  assert.equal(result.success, false);
  assert.equal(importArtist.mock.callCount(), 0);
});

test('useArtistMonitoring addArtistWithPolicy is a no-op when the artist is already monitored', async (t) => {
  const importArtist = t.mock.fn(createImportDouble());
  const toast = createToastDouble(t);
  const { addArtistWithPolicy } = useArtistMonitoring({
    importArtist,
    saveOperatorArtist: createOperatorSaveDouble(),
    initialMonitoredIds: ['mb-1'],
    toast,
  });

  const result = await addArtistWithPolicy({ id: 'mb-1', name: 'Already Monitored' });

  assert.equal(result.success, false);
  assert.equal(importArtist.mock.callCount(), 0);
});

test('useArtistMonitoring addArtistWithPolicy tracks state per artist independently', async (t) => {
  const toast = createToastDouble(t);
  const { monitoredIds, hasMonitored, addArtistWithPolicy } = useArtistMonitoring({
    importArtist: createImportDouble({ artistId: 'local-x' }),
    saveOperatorArtist: createOperatorSaveDouble(),
    toast,
  });

  await Promise.all([
    addArtistWithPolicy({ id: 'mb-a', name: 'Artist A' }),
    addArtistWithPolicy({ id: 'mb-b', name: 'Artist B' }),
  ]);

  assert.equal(monitoredIds.value.has('mb-a'), true);
  assert.equal(monitoredIds.value.has('mb-b'), true);
  assert.equal(hasMonitored.value, true);
  assert.equal(toast.success.mock.callCount(), 2);
});

// ---------------------------------------------------------------------------
// addArtistWithPolicy — explicit policy draft
// ---------------------------------------------------------------------------

test('useArtistMonitoring addArtistWithPolicy imports then saves operator draft built from the policy form', async (t) => {
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

// ---------------------------------------------------------------------------
// hasMonitored computed
// ---------------------------------------------------------------------------

test('useArtistMonitoring hasMonitored is false initially and becomes true after the first successful add', async (t) => {
  const toast = createToastDouble(t);
  const { hasMonitored, addArtistWithPolicy } = useArtistMonitoring({
    importArtist: createImportDouble(),
    saveOperatorArtist: createOperatorSaveDouble(),
    toast,
  });

  assert.equal(hasMonitored.value, false);

  await addArtistWithPolicy({ id: 'mb-first', name: 'First Artist' });

  assert.equal(hasMonitored.value, true);
});

test('useArtistMonitoring hasMonitored remains false when every add attempt fails', async (t) => {
  const toast = createToastDouble(t);
  const { hasMonitored, addArtistWithPolicy } = useArtistMonitoring({
    importArtist: async () => { throw new Error('fail'); },
    saveOperatorArtist: createOperatorSaveDouble(),
    toast,
  });

  await addArtistWithPolicy({ id: 'mb-bad', name: 'Bad Artist' });

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
  const { addArtistWithPolicy } = useArtistMonitoring({
    importArtist: createImportDouble(),
    saveOperatorArtist: createOperatorSaveDouble(),
    showToasts: false,
    toast,
  });

  await addArtistWithPolicy({ id: 'mb-quiet', name: 'Quiet Artist' });

  assert.equal(toast.success.mock.callCount(), 0);
  assert.equal(toast.error.mock.callCount(), 0);
});

test('useArtistMonitoring does not call toast on error when showToasts is false', async (t) => {
  const toast = createToastDouble(t);
  const { addArtistWithPolicy } = useArtistMonitoring({
    importArtist: async () => { throw new Error('silent fail'); },
    saveOperatorArtist: createOperatorSaveDouble(),
    showToasts: false,
    toast,
  });

  await addArtistWithPolicy({ id: 'mb-quiet-err', name: 'Quiet Error Artist' });

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

  const { isMonitoring, addArtistWithPolicy } = useArtistMonitoring({
    importArtist,
    saveOperatorArtist: createOperatorSaveDouble(),
    toast,
  });

  const addPromise = addArtistWithPolicy({ id: 'mb-check', name: 'Check Artist' });

  // isMonitoring should be true while the import is pending.
  inProgressChecked.value = isMonitoring('mb-check');
  await addPromise;

  assert.equal(inProgressChecked.value, true);
  assert.equal(isMonitoring('mb-check'), false);
});
