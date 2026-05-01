import assert from 'node:assert/strict';
import test from 'node:test';
import { ref } from 'vue';
import { useMetadataReleaseWorkflow } from '../../src/client/composables/useMetadataReleaseWorkflow.js';

test('useMetadataReleaseWorkflow loads release-group workspace from injected shared services', async (t) => {
  const resolveReleaseGroupLocal = t.mock.fn(async (releaseGroupId) => ({
    releaseGroup: {
      id: `local-${releaseGroupId}`,
      source: { musicbrainzReleaseGroupId: releaseGroupId },
    },
  }));
  const fetchReleaseGroupReleases = t.mock.fn(async (releaseGroupId) => ({
    releases: { results: [{ id: `provider-${releaseGroupId}` }] },
  }));

  const workflow = useMetadataReleaseWorkflow({
    selectedArtist: ref(null),
    refreshArtistWorkspace: async () => {},
    resolveReleaseGroupLocal,
    fetchReleaseGroupReleases,
  });

  workflow.localRelease.value = { release: { id: 'stale-release' } };
  workflow.releaseActionError.value = 'stale error';
  await workflow.loadReleaseGroupWorkspace({ id: 'mb-rg-1' });

  assert.equal(resolveReleaseGroupLocal.mock.callCount(), 1);
  assert.deepEqual(resolveReleaseGroupLocal.mock.calls[0].arguments, ['mb-rg-1']);
  assert.equal(fetchReleaseGroupReleases.mock.callCount(), 1);
  assert.deepEqual(fetchReleaseGroupReleases.mock.calls[0].arguments, ['mb-rg-1']);
  assert.deepEqual(workflow.localReleaseGroup.value, {
    releaseGroup: {
      id: 'local-mb-rg-1',
      source: { musicbrainzReleaseGroupId: 'mb-rg-1' },
    },
  });
  assert.deepEqual(workflow.providerReleases.value, [{ id: 'provider-mb-rg-1' }]);
  assert.equal(workflow.localRelease.value, null);
  assert.equal(workflow.releaseActionError.value, '');
  assert.equal(workflow.isLoadingReleaseGroup.value, false);
});

test('useMetadataReleaseWorkflow imports a release and refreshes the artist and active release group', async (t) => {
  const selectedArtist = ref({ id: 'mb-artist-1', name: 'Autechre' });
  const refreshArtistWorkspace = t.mock.fn(async () => {});
  const importReleaseById = t.mock.fn(async () => {});
  const resolveReleaseLocal = t.mock.fn(async (releaseId) => ({
    release: { id: `local-${releaseId}` },
  }));
  const resolveReleaseGroupLocal = t.mock.fn(async (releaseGroupId) => ({
    releaseGroup: {
      id: `local-${releaseGroupId}`,
      source: { musicbrainzReleaseGroupId: releaseGroupId },
    },
  }));
  const fetchReleaseGroupReleases = t.mock.fn(async (releaseGroupId) => ({
    releases: { results: [{ id: `provider-${releaseGroupId}` }] },
  }));

  const workflow = useMetadataReleaseWorkflow({
    selectedArtist,
    refreshArtistWorkspace,
    importReleaseById,
    resolveReleaseLocal,
    resolveReleaseGroupLocal,
    fetchReleaseGroupReleases,
  });

  workflow.localReleaseGroup.value = {
    releaseGroup: {
      id: 'local-mb-rg-1',
      source: { musicbrainzReleaseGroupId: 'mb-rg-1' },
    },
  };

  await workflow.importRelease({ id: 'mb-release-1' });

  assert.equal(importReleaseById.mock.callCount(), 1);
  assert.deepEqual(importReleaseById.mock.calls[0].arguments, ['mb-release-1']);
  assert.equal(resolveReleaseLocal.mock.callCount(), 1);
  assert.deepEqual(resolveReleaseLocal.mock.calls[0].arguments, ['mb-release-1']);
  assert.equal(refreshArtistWorkspace.mock.callCount(), 1);
  assert.deepEqual(refreshArtistWorkspace.mock.calls[0].arguments, [{ id: 'mb-artist-1', name: 'Autechre' }]);
  assert.equal(resolveReleaseGroupLocal.mock.callCount(), 1);
  assert.deepEqual(resolveReleaseGroupLocal.mock.calls[0].arguments, ['mb-rg-1']);
  assert.equal(fetchReleaseGroupReleases.mock.callCount(), 1);
  assert.deepEqual(fetchReleaseGroupReleases.mock.calls[0].arguments, ['mb-rg-1']);
  assert.deepEqual(workflow.localRelease.value, { release: { id: 'local-mb-release-1' } });
  assert.deepEqual(workflow.providerReleases.value, [{ id: 'provider-mb-rg-1' }]);
  assert.equal(workflow.releaseActionError.value, '');
  assert.equal(workflow.isImportingRelease.value, false);
});

test('useMetadataReleaseWorkflow opens a local release through injected read services', async (t) => {
  const fetchRelease = t.mock.fn(async (releaseId) => ({
    release: { id: releaseId, title: 'Chiastic Slide' },
  }));
  const fetchReleaseGroup = t.mock.fn(async (releaseGroupId) => ({
    releaseGroup: { id: releaseGroupId, title: 'EP7' },
  }));

  const workflow = useMetadataReleaseWorkflow({
    selectedArtist: ref(null),
    refreshArtistWorkspace: async () => {},
    fetchRelease,
    fetchReleaseGroup,
  });

  workflow.providerReleases.value = [{ id: 'provider-stale' }];
  await workflow.openLocalRelease({ id: 'local-release-1', releaseGroupId: 'local-rg-1' });

  assert.equal(fetchRelease.mock.callCount(), 1);
  assert.deepEqual(fetchRelease.mock.calls[0].arguments, ['local-release-1']);
  assert.equal(fetchReleaseGroup.mock.callCount(), 1);
  assert.deepEqual(fetchReleaseGroup.mock.calls[0].arguments, ['local-rg-1']);
  assert.deepEqual(workflow.localRelease.value, { release: { id: 'local-release-1', title: 'Chiastic Slide' } });
  assert.deepEqual(workflow.localReleaseGroup.value, { releaseGroup: { id: 'local-rg-1', title: 'EP7' } });
  assert.deepEqual(workflow.providerReleases.value, []);
  assert.equal(workflow.releaseActionError.value, '');
  assert.equal(workflow.isOpeningLocalRelease.value, false);
});

test('useMetadataReleaseWorkflow surfaces import failures through the shared error state', async () => {
  const workflow = useMetadataReleaseWorkflow({
    selectedArtist: ref({ id: 'mb-artist-1' }),
    refreshArtistWorkspace: async () => {},
    importReleaseById: async () => {
      throw new Error('release import failed upstream');
    },
  });

  await workflow.importRelease({ id: 'mb-release-1' });

  assert.equal(workflow.releaseActionError.value, 'release import failed upstream');
  assert.equal(workflow.isImportingRelease.value, false);
});