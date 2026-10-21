import assert from 'node:assert/strict';
import test from 'node:test';
import { ref } from 'vue';
import { canManageMetadata } from '../../src/client/lib/metadata-command-access-policy.js';
import { useMetadataArtistWorkflow } from '../../src/client/composables/useMetadataArtistWorkflow.js';
import { useMetadataReleaseWorkflow } from '../../src/client/composables/useMetadataReleaseWorkflow.js';

test('metadata command authority requires the exact admin role', () => {
  assert.equal(canManageMetadata('admin'), true);
  for (const role of ['operator', 'requester', 'ADMIN', '', true, null, undefined, {}]) assert.equal(canManageMetadata(role), false);
});

test('omitted and non-Boolean capabilities refuse dispatch before service calls or busy state', async t => {
  const dispatch = t.mock.fn(async () => { throw new Error('unexpected service call'); });
  for (const capability of [undefined, () => false, () => undefined, () => null, () => 'admin', () => ({})]) {
    const artist = useMetadataArtistWorkflow({ canManageMetadata: capability, startMetadataArtistRefreshRequest: dispatch });
    artist.localArtist.value = { artist: { id: 'artist-1' } };
    assert.equal(await artist.refreshArtistMetadata(), null);
    assert.equal(artist.isRefreshingArtist.value, false);
    assert.match(artist.artistActionError.value, /Administrator access/);
    const releases = useMetadataReleaseWorkflow({ canManageMetadata: capability, selectedArtist: ref(null), importReleaseById: dispatch, importReleaseGroupById: dispatch });
    await releases.importRelease({ id: 'release-1' }); await releases.importReleaseGroup({ id: 'group-1' });
    assert.equal(releases.isImportingRelease.value, false); assert.equal(releases.isImportingReleaseGroup.value, false);
    assert.match(releases.releaseActionError.value, /Administrator access/); assert.match(releases.releaseGroupActionError.value, /Administrator access/);
  }
  assert.equal(dispatch.mock.callCount(), 0);
});

test('artist factory forwards live authority to release dispatch and refuses stale events after revocation', async t => {
  let permitted = true;
  const refresh = t.mock.fn(async () => ({ run: { id: 'run-1' } }));
  const importGroup = t.mock.fn(async () => {}); const importRelease = t.mock.fn(async () => {});
  const workflow = useMetadataArtistWorkflow({
    canManageMetadata: () => permitted,
    startMetadataArtistRefreshRequest: refresh,
    createReleaseWorkflow: options => useMetadataReleaseWorkflow({
      ...options,
      refreshArtistWorkspace: async () => {},
      importReleaseById: importRelease,
      importReleaseGroupById: importGroup,
      resolveReleaseGroupLocal: async () => ({ releaseGroup: { id: 'group-1' } }),
      fetchReleaseGroupReleases: async () => ({ releases: { results: [] } }),
      resolveReleaseLocal: async () => ({ release: { id: 'release-1' } }),
    }),
  });
  workflow.localArtist.value = { artist: { id: 'artist-1' } };
  await workflow.refreshArtistMetadata(); await workflow.importReleaseGroup({ id: 'group-1' }); await workflow.importRelease({ id: 'release-1' });
  assert.deepEqual([refresh.mock.callCount(), importGroup.mock.callCount(), importRelease.mock.callCount()], [1, 1, 1]);
  permitted = false;
  await workflow.refreshArtistMetadata(); await workflow.importReleaseGroup({ id: 'group-1' }); await workflow.importRelease({ id: 'release-1' });
  assert.deepEqual([refresh.mock.callCount(), importGroup.mock.callCount(), importRelease.mock.callCount()], [1, 1, 1]);
  assert.deepEqual(workflow.queuedRefreshRun.value, { id: 'run-1' });
  assert.equal(workflow.isRefreshingArtist.value, false); assert.equal(workflow.isImportingRelease.value, false); assert.equal(workflow.isImportingReleaseGroup.value, false);
});

test('authenticated artist import does not require the privileged metadata capability', async t => {
  const importArtist = t.mock.fn(async () => {});
  const workflow = useMetadataArtistWorkflow({
    importArtistById: importArtist,
    resolveArtistLocal: async () => ({ artist: { id: 'local-artist' }, releaseGroups: [], releases: [] }),
    browseArtistReleaseGroups: async () => ({ browse: { results: [] } }),
  });
  await workflow.importArtist({ id: 'mb-artist' });
  assert.equal(importArtist.mock.callCount(), 1); assert.equal(workflow.localArtist.value.artist.id, 'local-artist');
  assert.equal(workflow.artistActionError.value, ''); assert.equal(workflow.isImportingArtist.value, false);
});
