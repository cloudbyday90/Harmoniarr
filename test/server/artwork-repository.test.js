import assert from 'node:assert/strict';
import test from 'node:test';
import {
  deleteArtworkAssetById,
  getArtworkCleanupSnapshot,
  getArtworkAssetBySha256,
  listArtworkCleanupCandidates,
  listArtworkAssignments,
  refreshArtworkAssetAssignmentState,
  upsertArtworkAsset,
  upsertArtworkAssignment,
} from '../../src/server/artwork/artwork-repository.js';

test('upsertArtworkAsset writes asset descriptors against the shared artwork tables', async (t) => {
  const queryable = {
    query: t.mock.fn(async (_sql, values) => ({
      rows: [{
        id: 'asset-1',
        storage_namespace: values[0],
        relative_path: values[1],
        sha256: values[2],
        mime_type: values[3],
        file_size_bytes: String(values[4]),
        width: values[5],
        height: values[6],
        storage_class: values[7],
        source_provider: values[8],
        source_url: values[9],
        payload_checksum: values[10],
        fetched_at: values[11],
        last_verified_at: values[12],
        created_at: '2026-05-01T12:00:00.000Z',
        updated_at: '2026-05-01T12:00:00.000Z',
      }],
    })),
  };

  const asset = await upsertArtworkAsset({
    fetchedAt: '2026-05-01T11:59:00.000Z',
    fileSizeBytes: 123456,
    height: 600,
    lastVerifiedAt: '2026-05-01T11:59:30.000Z',
    mimeType: 'image/jpeg',
    payloadChecksum: 'payload-1',
    relativePath: 'originals/aa/bb/asset-1.jpg',
    sha256: 'abc123',
    sourceProvider: 'coverArtArchive',
    sourceUrl: 'https://coverartarchive.org/release/example/front-1200.jpg',
    storageClass: 'provider_original',
    storageNamespace: 'artwork',
    width: 600,
  }, queryable);

  const [sql, values] = queryable.query.mock.calls[0].arguments;
  assert.match(sql, /INSERT INTO artwork_assets/);
  assert.match(sql, /ON CONFLICT \(sha256\) DO UPDATE/);
  assert.deepEqual(values, [
    'artwork',
    'originals/aa/bb/asset-1.jpg',
    'abc123',
    'image/jpeg',
    123456,
    600,
    600,
    'provider_original',
    'coverArtArchive',
    'https://coverartarchive.org/release/example/front-1200.jpg',
    'payload-1',
    '2026-05-01T11:59:00.000Z',
    '2026-05-01T11:59:30.000Z',
  ]);
  assert.deepEqual(asset, {
    createdAt: '2026-05-01T12:00:00.000Z',
    fetchedAt: '2026-05-01T11:59:00.000Z',
    fileSizeBytes: 123456,
    height: 600,
    id: 'asset-1',
    lastVerifiedAt: '2026-05-01T11:59:30.000Z',
    mimeType: 'image/jpeg',
    payloadChecksum: 'payload-1',
    relativePath: 'originals/aa/bb/asset-1.jpg',
    sha256: 'abc123',
    sourceProvider: 'coverArtArchive',
    sourceUrl: 'https://coverartarchive.org/release/example/front-1200.jpg',
    storageClass: 'provider_original',
    storageNamespace: 'artwork',
    unassignedAt: undefined,
    updatedAt: '2026-05-01T12:00:00.000Z',
    width: 600,
  });
});

test('getArtworkAssetBySha256 returns a mapped asset or null', async (t) => {
  const queryable = {
    query: t.mock.fn(async (_sql, values) => ({
      rows: values[0] === 'asset-sha'
        ? [{
            id: 'asset-1',
            storage_namespace: 'artwork',
            relative_path: 'originals/asset-1.webp',
            sha256: 'asset-sha',
            mime_type: 'image/webp',
            file_size_bytes: '456',
            width: 512,
            height: 512,
            storage_class: 'derivative',
            source_provider: null,
            source_url: null,
            payload_checksum: null,
            fetched_at: null,
            last_verified_at: null,
            created_at: '2026-05-01T12:00:00.000Z',
            updated_at: '2026-05-01T12:00:00.000Z',
          }]
        : [],
    })),
  };

  assert.equal((await getArtworkAssetBySha256('asset-sha', queryable)).id, 'asset-1');
  assert.equal(await getArtworkAssetBySha256('missing-sha', queryable), null);
});

test('upsertArtworkAssignment writes assignment state and preserves ordering fields', async (t) => {
  const queryable = {
    query: t.mock.fn(async (_sql, values) => ({
      rows: [{
        id: 'assignment-1',
        artwork_asset_id: values[0],
        owner_type: values[1],
        owner_id: values[2],
        artwork_role: values[3],
        source_provider: values[4],
        source_reference: values[5],
        is_preferred: values[6],
        priority: values[7],
        observed_at: values[8],
        created_at: '2026-05-01T12:05:00.000Z',
        updated_at: '2026-05-01T12:05:00.000Z',
      }],
    })),
  };

  const assignment = await upsertArtworkAssignment({
    artworkAssetId: 'asset-1',
    artworkRole: 'front_cover',
    isPreferred: true,
    observedAt: '2026-05-01T12:04:00.000Z',
    ownerId: 'release-1',
    ownerType: 'metadata_release',
    priority: 10,
    sourceProvider: 'coverArtArchive',
    sourceReference: 'front',
  }, queryable);

  const [sql, values] = queryable.query.mock.calls[0].arguments;
  assert.match(sql, /INSERT INTO artwork_assignments/);
  assert.match(sql, /ON CONFLICT \(owner_type, owner_id, artwork_role, artwork_asset_id\) DO UPDATE/);
  assert.deepEqual(values, [
    'asset-1',
    'metadata_release',
    'release-1',
    'front_cover',
    'coverArtArchive',
    'front',
    true,
    10,
    '2026-05-01T12:04:00.000Z',
  ]);
  assert.equal(assignment.isPreferred, true);
  assert.equal(assignment.priority, 10);
});

test('listArtworkAssignments returns preferred and lower-priority entries first', async (t) => {
  const queryable = {
    query: t.mock.fn(async () => ({
      rows: [{
        id: 'assignment-1',
        artwork_asset_id: 'asset-1',
        owner_type: 'metadata_release',
        owner_id: 'release-1',
        artwork_role: 'front_cover',
        source_provider: 'coverArtArchive',
        source_reference: 'front',
        is_preferred: true,
        priority: 10,
        observed_at: '2026-05-01T12:04:00.000Z',
        created_at: '2026-05-01T12:05:00.000Z',
        updated_at: '2026-05-01T12:05:00.000Z',
      }],
    })),
  };

  const assignments = await listArtworkAssignments({
    ownerId: 'release-1',
    ownerType: 'metadata_release',
  }, queryable);

  assert.match(queryable.query.mock.calls[0].arguments[0], /ORDER BY is_preferred DESC, priority ASC, created_at ASC, id ASC/);
  assert.deepEqual(queryable.query.mock.calls[0].arguments[1], ['metadata_release', 'release-1']);
  assert.equal(assignments[0].id, 'assignment-1');
});

test('listArtworkCleanupCandidates returns durable unassigned assets ordered by oldest retention marker first', async (t) => {
  const queryable = {
    query: t.mock.fn(async (_sql, values) => ({
      rows: [{
        id: 'asset-1',
        storage_namespace: 'artwork',
        relative_path: 'originals/aa/bb/asset-1.jpg',
        sha256: 'sha-1',
        mime_type: 'image/jpeg',
        file_size_bytes: '123',
        width: 600,
        height: 600,
        storage_class: values[1][0],
        source_provider: null,
        source_url: null,
        payload_checksum: 'payload-1',
        fetched_at: null,
        last_verified_at: '2026-05-01T12:00:00.000Z',
        created_at: '2026-04-01T12:00:00.000Z',
        unassigned_at: '2026-04-10T12:00:00.000Z',
        updated_at: '2026-05-01T12:00:00.000Z',
      }],
    })),
  };

  const cleanupCandidates = await listArtworkCleanupCandidates({
    limit: 25,
    storageClasses: ['provider_original', 'extracted_embedded'],
    unassignedBefore: '2026-04-15T00:00:00.000Z',
  }, queryable);

  const [sql, values] = queryable.query.mock.calls[0].arguments;
  assert.match(sql, /assets\.unassigned_at IS NOT NULL/);
  assert.match(sql, /assets\.storage_class = ANY\(\$2\)/);
  assert.match(sql, /NOT EXISTS/);
  assert.match(sql, /ORDER BY assets\.unassigned_at ASC, assets\.created_at ASC, assets\.id ASC/);
  assert.deepEqual(values, [
    '2026-04-15T00:00:00.000Z',
    ['provider_original', 'extracted_embedded'],
    25,
  ]);
  assert.equal(cleanupCandidates[0].unassignedAt, '2026-04-10T12:00:00.000Z');
});

test('refreshArtworkAssetAssignmentState updates tracked assets and ignores empty input', async (t) => {
  const queryable = {
    query: t.mock.fn(async (_sql, values) => ({
      rows: values[0].map((artworkAssetId, index) => ({
        id: artworkAssetId,
        storage_namespace: 'artwork',
        relative_path: `originals/aa/bb/${artworkAssetId}.jpg`,
        sha256: `${artworkAssetId}-sha`,
        mime_type: 'image/jpeg',
        file_size_bytes: '123',
        width: 600,
        height: 600,
        storage_class: 'provider_original',
        source_provider: null,
        source_url: null,
        payload_checksum: null,
        fetched_at: null,
        last_verified_at: null,
        created_at: '2026-04-01T12:00:00.000Z',
        unassigned_at: index === 0 ? null : '2026-05-01T12:00:00.000Z',
        updated_at: '2026-05-01T12:00:00.000Z',
      })),
    })),
  };

  assert.deepEqual(await refreshArtworkAssetAssignmentState([], queryable), []);

  const refreshedAssets = await refreshArtworkAssetAssignmentState(['asset-1', 'asset-2'], queryable);
  const [sql, values] = queryable.query.mock.calls[0].arguments;
  assert.match(sql, /UPDATE artwork_assets AS assets/);
  assert.match(sql, /COALESCE\(assets\.unassigned_at, NOW\(\)\)/);
  assert.match(sql, /WHERE assets\.id = ANY\(\$1::uuid\[\]\)/);
  assert.deepEqual(values, [['asset-1', 'asset-2']]);
  assert.equal(refreshedAssets[1].unassignedAt, '2026-05-01T12:00:00.000Z');
});

test('getArtworkCleanupSnapshot reports total and retention-eligible unassigned asset counts', async (t) => {
  const queryable = {
    query: t.mock.fn(async (_sql, values) => ({
      rows: [{
        eligible_asset_count: '2',
        oldest_unassigned_at: '2026-01-10T12:00:00.000Z',
        unassigned_asset_count: '4',
      }],
    })),
  };

  const snapshot = await getArtworkCleanupSnapshot({
    unassignedBefore: '2026-01-31T12:00:00.000Z',
  }, queryable);

  const [sql, values] = queryable.query.mock.calls[0].arguments;
  assert.match(sql, /eligible_asset_count/);
  assert.match(sql, /unassigned_asset_count/);
  assert.deepEqual(values, [
    '2026-01-31T12:00:00.000Z',
    ['provider_original', 'extracted_embedded', 'embedded_extract'],
  ]);
  assert.deepEqual(snapshot, {
    eligibleAssetCount: 2,
    oldestUnassignedAt: '2026-01-10T12:00:00.000Z',
    unassignedAssetCount: 4,
  });
});

test('deleteArtworkAssetById removes an artwork asset row and returns the deleted descriptor', async (t) => {
  const queryable = {
    query: t.mock.fn(async (_sql, values) => ({
      rows: [{
        id: values[0],
        storage_namespace: 'artwork',
        relative_path: 'extracted/aa/bb/asset-1.jpg',
        sha256: 'sha-1',
        mime_type: 'image/jpeg',
        file_size_bytes: '123',
        width: 600,
        height: 600,
        storage_class: 'extracted_embedded',
        source_provider: 'embedded',
        source_url: null,
        payload_checksum: 'payload-1',
        fetched_at: null,
        last_verified_at: '2026-05-01T12:00:00.000Z',
        created_at: '2026-04-01T12:00:00.000Z',
        unassigned_at: '2026-04-10T12:00:00.000Z',
        updated_at: '2026-05-01T12:00:00.000Z',
      }],
    })),
  };

  const deletedAsset = await deleteArtworkAssetById('asset-1', queryable);
  const [sql, values] = queryable.query.mock.calls[0].arguments;
  assert.match(sql, /DELETE FROM artwork_assets/);
  assert.match(sql, /RETURNING \*/);
  assert.deepEqual(values, ['asset-1']);
  assert.equal(deletedAsset.id, 'asset-1');
  assert.equal(deletedAsset.storageClass, 'extracted_embedded');
});