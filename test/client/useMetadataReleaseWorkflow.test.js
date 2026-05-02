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
  assert.equal(resolveReleaseGroupLocal.mock.calls[0].arguments[0], 'mb-rg-1');
  assert.ok(resolveReleaseGroupLocal.mock.calls[0].arguments[1].signal instanceof AbortSignal);
  assert.equal(fetchReleaseGroupReleases.mock.callCount(), 1);
  assert.equal(fetchReleaseGroupReleases.mock.calls[0].arguments[0], 'mb-rg-1');
  assert.ok(fetchReleaseGroupReleases.mock.calls[0].arguments[1].signal instanceof AbortSignal);
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
  assert.equal(resolveReleaseGroupLocal.mock.calls[0].arguments[0], 'mb-rg-1');
  assert.ok(resolveReleaseGroupLocal.mock.calls[0].arguments[1].signal instanceof AbortSignal);
  assert.equal(fetchReleaseGroupReleases.mock.callCount(), 1);
  assert.equal(fetchReleaseGroupReleases.mock.calls[0].arguments[0], 'mb-rg-1');
  assert.ok(fetchReleaseGroupReleases.mock.calls[0].arguments[1].signal instanceof AbortSignal);
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
  assert.equal(fetchRelease.mock.calls[0].arguments[0], 'local-release-1');
  assert.ok(fetchRelease.mock.calls[0].arguments[1].signal instanceof AbortSignal);
  assert.equal(fetchReleaseGroup.mock.callCount(), 1);
  assert.equal(fetchReleaseGroup.mock.calls[0].arguments[0], 'local-rg-1');
  assert.ok(fetchReleaseGroup.mock.calls[0].arguments[1].signal instanceof AbortSignal);
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

test('useMetadataReleaseWorkflow ignores stale release-group workspace responses when a newer selection starts', async () => {
  const firstLocalReleaseGroup = Promise.withResolvers();
  const secondLocalReleaseGroup = Promise.withResolvers();
  const firstProviderReleases = Promise.withResolvers();
  const secondProviderReleases = Promise.withResolvers();

  const resolveReleaseGroupLocal = (releaseGroupId) => (
    releaseGroupId === 'mb-rg-1' ? firstLocalReleaseGroup.promise : secondLocalReleaseGroup.promise
  );
  const fetchReleaseGroupReleases = (releaseGroupId) => (
    releaseGroupId === 'mb-rg-1' ? firstProviderReleases.promise : secondProviderReleases.promise
  );

  const workflow = useMetadataReleaseWorkflow({
    selectedArtist: ref(null),
    refreshArtistWorkspace: async () => {},
    resolveReleaseGroupLocal,
    fetchReleaseGroupReleases,
  });

  const openingFirstReleaseGroup = workflow.loadReleaseGroupWorkspace({ id: 'mb-rg-1' });
  const openingSecondReleaseGroup = workflow.loadReleaseGroupWorkspace({ id: 'mb-rg-2' });

  secondLocalReleaseGroup.resolve({
    releaseGroup: {
      id: 'local-mb-rg-2',
      source: { musicbrainzReleaseGroupId: 'mb-rg-2' },
    },
  });
  secondProviderReleases.resolve({
    releases: { results: [{ id: 'provider-mb-rg-2' }] },
  });

  await openingSecondReleaseGroup;

  firstLocalReleaseGroup.resolve({
    releaseGroup: {
      id: 'local-mb-rg-1',
      source: { musicbrainzReleaseGroupId: 'mb-rg-1' },
    },
  });
  firstProviderReleases.resolve({
    releases: { results: [{ id: 'provider-mb-rg-1' }] },
  });

  await openingFirstReleaseGroup;

  assert.deepEqual(workflow.localReleaseGroup.value, {
    releaseGroup: {
      id: 'local-mb-rg-2',
      source: { musicbrainzReleaseGroupId: 'mb-rg-2' },
    },
  });
  assert.deepEqual(workflow.providerReleases.value, [{ id: 'provider-mb-rg-2' }]);
  assert.equal(workflow.isLoadingReleaseGroup.value, false);
});

test('useMetadataReleaseWorkflow aborts superseded release-group reads', async () => {
  const firstLocalReleaseGroup = Promise.withResolvers();
  const secondLocalReleaseGroup = Promise.withResolvers();
  const firstProviderReleases = Promise.withResolvers();
  const secondProviderReleases = Promise.withResolvers();
  const localSignals = [];
  const providerSignals = [];

  const resolveReleaseGroupLocal = (releaseGroupId, { signal } = {}) => {
    localSignals.push({ releaseGroupId, signal });
    return releaseGroupId === 'mb-rg-1' ? firstLocalReleaseGroup.promise : secondLocalReleaseGroup.promise;
  };
  const fetchReleaseGroupReleases = (releaseGroupId, { signal } = {}) => {
    providerSignals.push({ releaseGroupId, signal });
    return releaseGroupId === 'mb-rg-1' ? firstProviderReleases.promise : secondProviderReleases.promise;
  };

  const workflow = useMetadataReleaseWorkflow({
    selectedArtist: ref(null),
    refreshArtistWorkspace: async () => {},
    resolveReleaseGroupLocal,
    fetchReleaseGroupReleases,
  });

  const openingFirstReleaseGroup = workflow.loadReleaseGroupWorkspace({ id: 'mb-rg-1' });
  const openingSecondReleaseGroup = workflow.loadReleaseGroupWorkspace({ id: 'mb-rg-2' });

  assert.equal(localSignals[0].releaseGroupId, 'mb-rg-1');
  assert.equal(localSignals[0].signal.aborted, true);
  assert.equal(providerSignals[0].releaseGroupId, 'mb-rg-1');
  assert.equal(providerSignals[0].signal.aborted, true);
  assert.equal(localSignals[1].signal.aborted, false);
  assert.equal(providerSignals[1].signal.aborted, false);

  secondLocalReleaseGroup.resolve({
    releaseGroup: {
      id: 'local-mb-rg-2',
      source: { musicbrainzReleaseGroupId: 'mb-rg-2' },
    },
  });
  secondProviderReleases.resolve({
    releases: { results: [{ id: 'provider-mb-rg-2' }] },
  });

  await openingSecondReleaseGroup;

  firstLocalReleaseGroup.resolve({
    releaseGroup: {
      id: 'local-mb-rg-1',
      source: { musicbrainzReleaseGroupId: 'mb-rg-1' },
    },
  });
  firstProviderReleases.resolve({
    releases: { results: [{ id: 'provider-mb-rg-1' }] },
  });

  await openingFirstReleaseGroup;
});

test('useMetadataReleaseWorkflow suppresses abort errors for route-owned release-group reads', async () => {
  const workflow = useMetadataReleaseWorkflow({
    selectedArtist: ref(null),
    refreshArtistWorkspace: async () => {},
    resolveReleaseGroupLocal: async () => {
      const error = new Error('The operation was aborted');
      error.name = 'AbortError';
      error.code = 'request_aborted';
      throw error;
    },
    fetchReleaseGroupReleases: async () => ({ releases: { results: [] } }),
  });

  await workflow.loadReleaseGroupWorkspace({ id: 'mb-rg-1' });

  assert.equal(workflow.releaseGroupActionError.value, '');
  assert.equal(workflow.isLoadingReleaseGroup.value, false);
});