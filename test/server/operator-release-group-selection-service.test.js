import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createOperatorReleaseGroupSelectionService,
  normalizeOperatorReleaseGroupSelectionPatch,
} from '../../src/server/metadata/operator-release-group-selection-service.js';

test('normalizeOperatorReleaseGroupSelectionPatch validates and normalizes selection state', () => {
  const result = normalizeOperatorReleaseGroupSelectionPatch({
    resolvedMetadataReleaseId: 'release-1',
    selectionSource: 'POLICY',
    selectionState: 'PARTIAL',
  });

  assert.deepEqual(result, {
    resolvedMetadataReleaseId: 'release-1',
    selectionOrigin: null,
    selectionSource: 'policy',
    selectionState: 'partial',
  });
});

test('normalizeOperatorReleaseGroupSelectionPatch allowlists an origin and requires a manual source', () => {
  assert.deepEqual(
    normalizeOperatorReleaseGroupSelectionPatch({
      selectionOrigin: 'MANUAL_EDITION',
      selectionSource: 'manual',
    }),
    {
      resolvedMetadataReleaseId: null,
      selectionOrigin: 'manual_edition',
      selectionSource: 'manual',
      selectionState: 'selected',
    },
  );

  assert.throws(
    () => normalizeOperatorReleaseGroupSelectionPatch({
      selectionOrigin: 'manual_edition',
      selectionSource: 'policy',
    }),
    {
      code: 'validation_error',
      message: 'Selection origin requires manual selection source',
      status: 400,
    },
  );
  assert.throws(
    () => normalizeOperatorReleaseGroupSelectionPatch({ selectionOrigin: 'untrusted_value' }),
    {
      code: 'validation_error',
      message: 'Unsupported selection origin: untrusted_value',
      status: 400,
    },
  );
});

test('normalizeOperatorReleaseGroupSelectionPatch rejects unsupported selection states', () => {
  assert.throws(
    () => normalizeOperatorReleaseGroupSelectionPatch({
      selectionState: 'ignored',
    }),
    {
      code: 'validation_error',
      message: 'Unsupported selection state: ignored',
      status: 400,
    },
  );
});

test('updateOperatorReleaseGroupSelection validates artist and release membership before persisting', async (t) => {
  const query = t.mock.fn(async (sql, params) => {
    if (sql.includes('FROM app_users')) {
      return { rows: [{ id: 'user-1' }] };
    }

    if (sql.includes('SELECT id FROM metadata_artists')) {
      return { rows: [{ id: 'artist-1' }] };
    }

    if (sql.includes('FROM metadata_release_groups')) {
      assert.deepEqual(params, ['release-group-1']);
      return { rows: [{ id: 'release-group-1', metadata_artist_id: 'artist-1' }] };
    }

    if (sql.includes('FROM metadata_releases')) {
      assert.deepEqual(params, ['release-1', 'release-group-1']);
      return { rows: [{ id: 'release-1' }] };
    }

    return { rows: [] };
  });
  const upsertOperatorReleaseGroupSelection = t.mock.fn(async () => {});
  const service = createOperatorReleaseGroupSelectionService({
    getPoolFn: () => ({ query }),
    operatorReleaseGroupSelectionStore: {
      getOperatorReleaseGroupSelection: async () => null,
      upsertOperatorReleaseGroupSelection,
    },
  });

  const result = await service.updateOperatorReleaseGroupSelection({
    appUserId: 'user-1',
    metadataArtistId: 'artist-1',
    metadataReleaseGroupId: 'release-group-1',
    patch: {
      resolvedMetadataReleaseId: 'release-1',
      selectionOrigin: null,
      selectionSource: 'manual',
      selectionState: 'partial',
    },
  });

  assert.deepEqual(upsertOperatorReleaseGroupSelection.mock.calls[0].arguments[0], {
    appUserId: 'user-1',
    metadataArtistId: 'artist-1',
    metadataReleaseGroupId: 'release-group-1',
    resolvedMetadataReleaseId: 'release-1',
    selectionOrigin: null,
    selectionSource: 'manual',
    selectionState: 'partial',
  });
  assert.deepEqual(result, {
    appUserId: 'user-1',
    metadataArtistId: 'artist-1',
    metadataReleaseGroupId: 'release-group-1',
    selection: {
      resolvedMetadataReleaseId: 'release-1',
      selectionOrigin: null,
      selectionSource: 'manual',
      selectionState: 'partial',
    },
  });
});

test('updateOperatorReleaseGroupSelection rejects release groups that do not belong to the requested artist', async () => {
  const service = createOperatorReleaseGroupSelectionService({
    getPoolFn: () => ({
      query: async (sql) => {
        if (sql.includes('FROM app_users')) {
          return { rows: [{ id: 'user-1' }] };
        }

        if (sql.includes('SELECT id FROM metadata_artists')) {
          return { rows: [{ id: 'artist-1' }] };
        }

        if (sql.includes('FROM metadata_release_groups')) {
          return { rows: [{ id: 'release-group-1', metadata_artist_id: 'artist-2' }] };
        }

        return { rows: [] };
      },
    }),
    operatorReleaseGroupSelectionStore: {
      getOperatorReleaseGroupSelection: async () => null,
      upsertOperatorReleaseGroupSelection: async () => {},
    },
  });

  await assert.rejects(
    service.updateOperatorReleaseGroupSelection({
      appUserId: 'user-1',
      metadataArtistId: 'artist-1',
      metadataReleaseGroupId: 'release-group-1',
      patch: {
        selectionState: 'selected',
      },
    }),
    {
      code: 'validation_error',
      message: 'Release group release-group-1 does not belong to artist artist-1',
      status: 400,
    },
  );
});

test('updateOperatorReleaseGroupSelection rejects resolved releases outside the release group', async () => {
  const service = createOperatorReleaseGroupSelectionService({
    getPoolFn: () => ({
      query: async (sql) => {
        if (sql.includes('FROM app_users')) {
          return { rows: [{ id: 'user-1' }] };
        }

        if (sql.includes('SELECT id FROM metadata_artists')) {
          return { rows: [{ id: 'artist-1' }] };
        }

        if (sql.includes('FROM metadata_release_groups')) {
          return { rows: [{ id: 'release-group-1', metadata_artist_id: 'artist-1' }] };
        }

        if (sql.includes('FROM metadata_releases')) {
          return { rows: [] };
        }

        return { rows: [] };
      },
    }),
    operatorReleaseGroupSelectionStore: {
      getOperatorReleaseGroupSelection: async () => null,
      upsertOperatorReleaseGroupSelection: async () => {},
    },
  });

  await assert.rejects(
    service.updateOperatorReleaseGroupSelection({
      appUserId: 'user-1',
      metadataArtistId: 'artist-1',
      metadataReleaseGroupId: 'release-group-1',
      patch: {
        resolvedMetadataReleaseId: 'release-9',
        selectionState: 'selected',
      },
    }),
    {
      code: 'validation_error',
      message: 'Resolved release release-9 does not belong to release group release-group-1',
      status: 400,
    },
  );
});
