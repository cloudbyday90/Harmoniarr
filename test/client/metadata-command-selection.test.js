import assert from 'node:assert/strict';
import test from 'node:test';
import { ref } from 'vue';
import { useMetadataArtistWorkflow } from '../../src/client/composables/useMetadataArtistWorkflow.js';
import { useMetadataReleaseWorkflow } from '../../src/client/composables/useMetadataReleaseWorkflow.js';
import { withResolvers } from '../../testing/client/promise-helpers.js';

function createArtistWorkflow(options = {}) {
  return useMetadataArtistWorkflow({
    canManageMetadata: () => true,
    fetchArtist: async id => ({ artist: { id, name: id, source: { musicbrainzArtistId: `mb-${id}` } }, releaseGroups: [], releases: [] }),
    browseArtistReleaseGroups: async () => ({ browse: { results: [] } }),
    ...options,
  });
}

function createReleaseWorkflow(options = {}) {
  return useMetadataReleaseWorkflow({
    canManageMetadata: () => true,
    selectedArtist: ref({ id: 'mb-artist-a' }),
    refreshArtistWorkspace: async () => {},
    fetchReleaseGroup: async id => ({ releaseGroup: { id } }),
    fetchRelease: async id => ({ release: { id } }),
    ...options,
  });
}

test('old refresh acceptance cannot publish or clear a newer command after artist A to B to A', async t => {
  const old = withResolvers(); const current = withResolvers(); let calls = 0;
  const workflow = createArtistWorkflow({ startMetadataArtistRefreshRequest: () => (++calls === 1 ? old.promise : current.promise) });
  await workflow.openLocalArtist({ id: 'a' });
  const first = workflow.refreshArtistMetadata();
  assert.equal(await workflow.refreshArtistMetadata(), null); assert.equal(calls, 1);
  await workflow.openLocalArtist({ id: 'b' }); await workflow.openLocalArtist({ id: 'a' });
  const second = workflow.refreshArtistMetadata();
  t.after(async () => { old.resolve({}); current.resolve({}); await Promise.all([first, second]); });
  old.resolve({ run: { id: 'old-accepted-run' } }); await first;
  assert.equal(workflow.queuedRefreshRun.value, null);
  assert.equal(workflow.isRefreshingArtist.value, true);
  current.resolve({ run: { id: 'current-run' } }); await second;
  assert.deepEqual(workflow.queuedRefreshRun.value, { id: 'current-run' });
  assert.equal(workflow.isRefreshingArtist.value, false); assert.equal(calls, 2);
});

test('a stale refresh failure cannot replace the new artist feedback', async () => {
  const response = withResolvers();
  const workflow = createArtistWorkflow({ startMetadataArtistRefreshRequest: () => response.promise });
  await workflow.openLocalArtist({ id: 'a' }); const pending = workflow.refreshArtistMetadata();
  await workflow.openLocalArtist({ id: 'b' }); response.reject(new Error('old artist failure')); await pending;
  assert.equal(workflow.localArtist.value.artist.id, 'b');
  assert.equal(workflow.artistActionError.value, ''); assert.equal(workflow.isRefreshingArtist.value, false);
});

test('late group import acceptance preserves a newer saved group without starting follow-up reads', async t => {
  const response = withResolvers(); const resolveGroup = t.mock.fn(async () => ({ releaseGroup: { id: 'old' } }));
  const refreshArtist = t.mock.fn(async () => {});
  const workflow = createReleaseWorkflow({ importReleaseGroupById: () => response.promise, resolveReleaseGroupLocal: resolveGroup, refreshArtistWorkspace: refreshArtist, fetchReleaseGroupReleases: async () => ({ releases: { results: [] } }) });
  const pending = workflow.importReleaseGroup({ id: 'old-mbid' });
  await workflow.openLocalReleaseGroup({ id: 'new-group' }); response.resolve(); await pending;
  assert.equal(workflow.localReleaseGroup.value.releaseGroup.id, 'new-group');
  assert.equal(resolveGroup.mock.callCount(), 0); assert.equal(refreshArtist.mock.callCount(), 0);
  assert.equal(workflow.isImportingReleaseGroup.value, false); assert.equal(workflow.isLoadingReleaseGroup.value, false);
});

test('late release import acceptance does not resolve into a newer local release', async t => {
  const response = withResolvers(); const resolveRelease = t.mock.fn(async () => ({ release: { id: 'old' } }));
  const workflow = createReleaseWorkflow({ importReleaseById: () => response.promise, resolveReleaseLocal: resolveRelease });
  const pending = workflow.importRelease({ id: 'old-mbid' });
  await workflow.openLocalRelease({ id: 'new-release', releaseGroupId: 'new-group' }); response.resolve(); await pending;
  assert.equal(workflow.localRelease.value.release.id, 'new-release'); assert.equal(resolveRelease.mock.callCount(), 0);
  assert.equal(workflow.isImportingRelease.value, false);
});

test('a held release lookup cannot publish after a newer release selection', async () => {
  const lookup = withResolvers(); const entered = withResolvers();
  let signal;
  const workflow = createReleaseWorkflow({ importReleaseById: async () => {}, resolveReleaseLocal: (_id, options) => { signal = options.signal; entered.resolve(); return lookup.promise; } });
  const pending = workflow.importRelease({ id: 'old-mbid' }); await entered.promise;
  await workflow.openLocalRelease({ id: 'new-release', releaseGroupId: 'new-group' });
  assert.equal(signal.aborted, true);
  lookup.resolve({ release: { id: 'old-release' } }); await pending;
  assert.equal(workflow.localRelease.value.release.id, 'new-release');
  assert.equal(workflow.releaseActionError.value, ''); assert.equal(workflow.isImportingRelease.value, false);
});

test('command follow-up catalog reads cannot publish into another artist or reset its pending command', async t => {
  const artistRead = withResolvers(); const groupRead = withResolvers(); const entered = withResolvers();
  const freshRefresh = withResolvers(); let reads = 0;
  const workflow = createArtistWorkflow({
    startMetadataArtistRefreshRequest: () => freshRefresh.promise,
    resolveArtistLocal: () => { if (++reads === 2) entered.resolve(); return artistRead.promise; },
    createReleaseWorkflow: options => useMetadataReleaseWorkflow({ ...options,
      importReleaseGroupById: async () => {},
      resolveReleaseGroupLocal: () => { if (++reads === 2) entered.resolve(); return groupRead.promise; },
      fetchReleaseGroupReleases: async () => ({ releases: { results: [] } }),
    }),
  });
  await workflow.openLocalArtist({ id: 'a' }); const pending = workflow.importReleaseGroup({ id: 'group-a' });
  await entered.promise; await workflow.openLocalArtist({ id: 'b' });
  const current = workflow.refreshArtistMetadata();
  t.after(async () => { artistRead.resolve({}); groupRead.resolve({}); freshRefresh.resolve({}); await Promise.all([pending, current]); });
  artistRead.resolve({ artist: { id: 'a' }, releaseGroups: [], releases: [] });
  groupRead.resolve({ releaseGroup: { id: 'group-a' } }); await pending;
  assert.equal(workflow.localArtist.value.artist.id, 'b'); assert.equal(workflow.localReleaseGroup.value, null);
  assert.equal(workflow.isRefreshingArtist.value, true); assert.equal(workflow.isLoadingReleaseGroup.value, false);
  freshRefresh.resolve({ run: { id: 'b-run' } }); await current;
});

test('an obsolete import completion cannot clear a new command pending in the same selection', async t => {
  for (const command of ['importReleaseGroup', 'importRelease']) {
    const old = withResolvers(); const current = withResolvers(); let calls = 0;
    const dispatch = () => (++calls === 1 ? old.promise : current.promise);
    const workflow = createReleaseWorkflow({ importReleaseGroupById: dispatch, importReleaseById: dispatch });
    const first = workflow[command]({ id: 'old' }); workflow.resetReleaseSelection();
    const second = workflow[command]({ id: 'new' });
    t.after(async () => { old.resolve(); current.reject(new Error('current failure')); await Promise.all([first, second]); });
    old.resolve(); await first;
    assert.equal(command === 'importRelease' ? workflow.isImportingRelease.value : workflow.isImportingReleaseGroup.value, true);
    current.reject(new Error('current failure')); await second;
    assert.equal(command === 'importRelease' ? workflow.releaseActionError.value : workflow.releaseGroupActionError.value, 'current failure');
  }
});

test('stale import rejection leaves new selection errors and busy flags untouched', async () => {
  for (const command of ['importReleaseGroup', 'importRelease']) {
    const response = withResolvers();
    const workflow = createReleaseWorkflow({ importReleaseGroupById: () => response.promise, importReleaseById: () => response.promise });
    const pending = workflow[command]({ id: 'old' }); workflow.resetReleaseSelection();
    workflow.releaseGroupActionError.value = 'current group feedback'; workflow.releaseActionError.value = 'current release feedback';
    response.reject(new Error('old failure')); await pending;
    assert.equal(workflow.releaseGroupActionError.value, 'current group feedback');
    assert.equal(workflow.releaseActionError.value, 'current release feedback');
    assert.equal(workflow.isImportingRelease.value, false); assert.equal(workflow.isImportingReleaseGroup.value, false);
  }
});
