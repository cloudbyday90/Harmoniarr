import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryReleaseReconciliationStore } from '../../src/server/library/library-release-reconciliation-store.js';

function createProjectionQuery(t, { targets = [], deletedRows = null, writtenRows = null, failAt = null, events = [], onAdmission = null } = {}) {
  return t.mock.fn(async (sql, values) => {
    if (/pg_advisory_xact_lock/u.test(sql)) { events.push('admission'); await onAdmission?.(); return { rows: [] }; }
    if (/SELECT metadata_release_id FROM library_release_reconciliations/u.test(sql)) {
      events.push('targets'); return { rows: targets.map((metadataReleaseId) => ({ metadata_release_id: metadataReleaseId })) };
    }
    if (/DELETE FROM library_release_reconciliations/u.test(sql)) {
      events.push('delete'); if (failAt === 'delete') throw new Error('Delete failed');
      const rows = deletedRows ?? targets.filter((id) => !values[0].includes(id)).map((metadataReleaseId) => ({ metadata_release_id: metadataReleaseId }));
      return { rowCount: rows.length, rows };
    }
    if (/INSERT INTO library_release_reconciliations/u.test(sql)) {
      events.push('upsert'); if (failAt === 'upsert') throw new Error('Upsert failed');
      const rows = writtenRows ?? values[2].map((metadataReleaseId) => ({ metadata_release_id: metadataReleaseId }));
      return { rowCount: rows.length, rows };
    }
    events.push(sql); return { rows: [] };
  });
}

test('replaceLibraryReleaseReconciliations replaces the current reconciliation projection in one transaction', async (t) => {
  const query = createProjectionQuery(t, { targets: ['release-old'] });
  const release = t.mock.fn(() => {});
  const store = createLibraryReleaseReconciliationStore({
    getPoolFn: () => ({
      connect: async () => ({
        query,
        release,
      }),
    }),
  });

  await store.replaceLibraryReleaseReconciliations({
    reconciliations: [{
      duplicateTrackCount: 0,
      evidence: {
        strategy: 'matched_track_coverage',
        trackCoverage: 1,
      },
      expectedTrackCount: 2,
      matchedFileCount: 2,
      matchedTrackCount: 2,
      metadataArtistId: 'artist-1',
      metadataReleaseGroupId: 'release-group-1',
      metadataReleaseId: 'release-1',
      missingTrackCount: 0,
      reconciliationStatus: 'complete',
    }],
  });

  assert.equal(query.mock.calls[0].arguments[0], 'BEGIN');
  assert.match(query.mock.calls[1].arguments[0], /pg_advisory_xact_lock/u);
  const deleted = query.mock.calls.find((call) => /DELETE FROM library_release_reconciliations/u.test(call.arguments[0]));
  assert.deepEqual(deleted.arguments[1], [['release-1']]);
  const written = query.mock.calls.find((call) => /INSERT INTO library_release_reconciliations/u.test(call.arguments[0]));
  assert.deepEqual(written.arguments[1], [
    ['artist-1'],
    ['release-group-1'],
    ['release-1'],
    ['complete'],
    [2],
    [2],
    [0],
    [2],
    [0],
    ['{"strategy":"matched_track_coverage","trackCoverage":1}'],
  ]);
  assert.equal(query.mock.calls.at(-1).arguments[0], 'COMMIT');
  assert.equal(release.mock.callCount(), 1);
});

test('replaceLibraryReleaseReconciliations clears the projection when no reconciliations remain', async (t) => {
  const query = createProjectionQuery(t, { targets: ['release-1', 'release-2'] });
  const release = t.mock.fn(() => {});
  const store = createLibraryReleaseReconciliationStore({
    getPoolFn: () => ({
      connect: async () => ({
        query,
        release,
      }),
    }),
  });

  const result = await store.replaceLibraryReleaseReconciliations({
    reconciliations: [],
  });

  assert.equal(query.mock.calls[0].arguments[0], 'BEGIN');
  const deleted = query.mock.calls.find((call) => /DELETE FROM library_release_reconciliations/u.test(call.arguments[0]));
  assert.deepEqual(deleted.arguments[1], [[]]);
  assert.equal(query.mock.calls.some((call) => /INSERT INTO library_release_reconciliations/u.test(call.arguments[0])), false);
  assert.deepEqual(result, { metadataReleaseIds: [], deletedMetadataReleaseIds: ['release-1', 'release-2'] });
  assert.equal(query.mock.calls.at(-1).arguments[0], 'COMMIT');
  assert.equal(release.mock.callCount(), 1);
});

test('listReconciliationsByMetadataReleaseIds returns compact reconciliation rows for targeted releases', async (t) => {
  const query = t.mock.fn(async (_sql, params) => {
    assert.deepEqual(params, [['release-1', 'release-2']]);
    return {
      rows: [{
        duplicate_track_count: 1,
        evidence: { source: 'library_scan' },
        expected_track_count: 10,
        last_reconciled_at: '2026-05-25T15:00:00.000Z',
        matched_file_count: 8,
        matched_track_count: 8,
        metadata_artist_id: 'artist-1',
        metadata_release_group_id: 'group-1',
        metadata_release_id: 'release-1',
        missing_track_count: 2,
        reconciliation_status: 'partial',
      }],
    };
  });
  const store = createLibraryReleaseReconciliationStore({
    getPoolFn: () => ({ query }),
  });

  const reconciliations = await store.listReconciliationsByMetadataReleaseIds({
    metadataReleaseIds: ['release-1', 'release-2'],
  });

  assert.deepEqual(reconciliations, [{
    duplicateTrackCount: 1,
    evidence: { source: 'library_scan' },
    expectedTrackCount: 10,
    lastReconciledAt: '2026-05-25T15:00:00.000Z',
    matchedFileCount: 8,
    matchedTrackCount: 8,
    metadataArtistId: 'artist-1',
    metadataReleaseGroupId: 'group-1',
    metadataReleaseId: 'release-1',
    missingTrackCount: 2,
    reconciliationStatus: 'partial',
  }]);
});

test('listLibraryReleasesWithMetadata filters removed releases for the operator view', async (t) => {
  const query = t.mock.fn(async (sql, params) => {
    assert.match(sql, /LEFT JOIN operator_library_release_visibility olrv/);
    assert.match(sql, /COALESCE\(olrv\.visibility_state, 'visible'\) = 'visible'/);
    assert.deepEqual(params, ['operator-1', 25]);
    return {
      rows: [{
        artist_name: 'Radiohead',
        artist_sort_name: 'Radiohead',
        duplicate_track_count: 0,
        expected_track_count: 12,
        id: 'recon-1',
        last_reconciled_at: '2026-06-30T10:00:00.000Z',
        matched_file_count: 12,
        matched_track_count: 12,
        metadata_artist_id: 'artist-1',
        metadata_release_group_id: 'rg-1',
        metadata_release_id: 'release-1',
        missing_track_count: 0,
        musicbrainz_release_group_id: 'rg-mbid-1',
        musicbrainz_release_id: 'release-mbid-1',
        operator_removed_at: null,
        operator_restored_at: null,
        operator_visibility_reason: null,
        operator_visibility_state: 'visible',
        reconciliation_status: 'complete',
        release_country: 'GB',
        release_date: '1997-05-21',
        release_disambiguation: null,
        release_group_title: 'OK Computer',
        release_group_type: 'Album',
        release_status: 'Official',
        release_title: 'OK Computer',
      }],
    };
  });
  const store = createLibraryReleaseReconciliationStore({
    getPoolFn: () => ({ query }),
  });

  const releases = await store.listLibraryReleasesWithMetadata({
    appUserId: 'operator-1',
    limit: 25,
    visibilityState: 'visible',
  });

  assert.equal(releases[0].operatorVisibility.state, 'visible');
});

test('listLibraryReleasesWithMetadata can list removed releases', async (t) => {
  const query = t.mock.fn(async (sql, params) => {
    assert.match(sql, /olrv\.visibility_state = 'removed'/);
    assert.deepEqual(params, ['operator-1', 500]);
    return { rows: [] };
  });
  const store = createLibraryReleaseReconciliationStore({
    getPoolFn: () => ({ query }),
  });

  await store.listLibraryReleasesWithMetadata({
    appUserId: 'operator-1',
    visibilityState: 'removed',
  });
});

function projectionRow(id = 'release-1', changes = {}) {
  return { metadataArtistId: 'artist-1', metadataReleaseGroupId: 'group-1', metadataReleaseId: id,
    reconciliationStatus: 'complete', expectedTrackCount: 2, matchedTrackCount: 2, missingTrackCount: 0,
    matchedFileCount: 2, duplicateTrackCount: 0, evidence: { strategy: 'matched_track_coverage', trackCoverage: 1 }, ...changes };
}
function standaloneStore(query, release) {
  return createLibraryReleaseReconciliationStore({ getPoolFn: () => ({ connect: async () => ({ query, release }) }) });
}

test('supplied-client replacement takes projection admission and awaits guards without nesting or borrowing', async (t) => {
  const events = []; const query = createProjectionQuery(t, { targets: ['obsolete'], events }); const queryable = { query };
  const store = createLibraryReleaseReconciliationStore({ getPoolFn: () => { assert.fail('Owner already supplies a connection'); },
    withTransaction: async () => { assert.fail('Caller transaction must not be nested'); },
  });
  const result = await store.replaceLibraryReleaseReconciliations({ reconciliations: [projectionRow()], queryable,
    beforeWrite: async ({ queryable: client, stage }) => { await Promise.resolve(); assert.equal(client, queryable); events.push(`guard:${stage}`); },
  });
  assert.deepEqual(events, ['admission', 'targets', 'guard:delete', 'delete', 'guard:upsert_batch', 'upsert']);
  assert.deepEqual(result, { metadataReleaseIds: ['release-1'], deletedMetadataReleaseIds: ['obsolete'] });
  assert.deepEqual(query.mock.calls[0].arguments[1], ['harmoniarr.library-release-reconciliation']);
});

test('replacement waits for the deletion guard after admission and target observation', async (t) => {
  const events = []; const query = createProjectionQuery(t, { events }); const queryable = { query };
  let entered; let resume; const ready = new Promise((done) => { entered = done; }); const paused = new Promise((done) => { resume = done; });
  const store = createLibraryReleaseReconciliationStore({ getPoolFn: () => { assert.fail('Unexpected connection'); } });
  const running = store.replaceLibraryReleaseReconciliations({ reconciliations: [projectionRow()], queryable,
    beforeWrite: async ({ stage }) => { if (stage === 'delete') { entered(); await paused; } },
  });
  await ready; assert.deepEqual(events, ['admission', 'targets']); resume(); await running;
  assert.deepEqual(events, ['admission', 'targets', 'delete', 'upsert']);
});

test('standalone input deduplication and persistence values are captured before admission waits', async (t) => {
  const rows = [projectionRow('release-1', { matchedTrackCount: 1 }), projectionRow('release-2'), projectionRow('release-1')];
  const query = createProjectionQuery(t, { onAdmission: async () => {
    await Promise.resolve(); rows[2].metadataReleaseId = 'changed'; rows[2].expectedTrackCount = 999; rows[2].evidence.trackCoverage = 0;
  } });
  const release = t.mock.fn(); const store = standaloneStore(query, release);
  assert.deepEqual(await store.replaceLibraryReleaseReconciliations({ reconciliations: rows }), { metadataReleaseIds: ['release-2', 'release-1'], deletedMetadataReleaseIds: [] });
  const args = query.mock.calls.find((call) => /INSERT INTO library_release_reconciliations/u.test(call.arguments[0])).arguments[1];
  assert.deepEqual(args[2], ['release-2', 'release-1']); assert.deepEqual(args[4], [2, 2]);
  assert.deepEqual(args[9], ['{"strategy":"matched_track_coverage","trackCoverage":1}', '{"strategy":"matched_track_coverage","trackCoverage":1}']);
  assert.equal(release.mock.callCount(), 1);
});

for (const stage of ['delete', 'upsert_batch']) {
  test(`${stage} guard refusal rolls back the entire standalone replacement without retry`, async (t) => {
    const events = []; const query = createProjectionQuery(t, { targets: ['obsolete'], events }); const release = t.mock.fn();
    const failure = Object.assign(new Error('Stale'), { code: 'library_release_reconciliation_stale' });
    await assert.rejects(standaloneStore(query, release).replaceLibraryReleaseReconciliations({ reconciliations: [projectionRow()],
      beforeWrite: async (args) => { if (args.stage === stage) throw failure; },
    }), (error) => error === failure);
    assert.equal(events.includes('delete'), stage === 'upsert_batch'); assert.equal(events.includes('upsert'), false);
    assert.equal(events.at(-1), 'ROLLBACK'); assert.equal(events.includes('COMMIT'), false); assert.equal(release.mock.callCount(), 1);
  });
}

test('DELETE and bulk upsert SQL failures roll back all projection changes and preserve the error', async (t) => {
  for (const failAt of ['delete', 'upsert']) {
    const events = []; const query = createProjectionQuery(t, { targets: ['obsolete'], events, failAt }); const release = t.mock.fn();
    await assert.rejects(standaloneStore(query, release).replaceLibraryReleaseReconciliations({ reconciliations: [projectionRow(), projectionRow('release-2')] }),
      (error) => error.message === (failAt === 'delete' ? 'Delete failed' : 'Upsert failed'));
    assert.equal(events.at(-1), 'ROLLBACK'); assert.equal(events.includes('COMMIT'), false); assert.equal(release.mock.callCount(), 1);
  }
});

test('exact deleted identity verification refuses missing, extra, foreign or duplicated deletion results', async (t) => {
  for (const deletedRows of [[], [{ metadata_release_id: 'old-1' }], [{ metadata_release_id: 'old-1' }, { metadata_release_id: 'old-1' }],
    [{ metadata_release_id: 'old-1' }, { metadata_release_id: 'foreign' }],
    [{ metadata_release_id: 'old-1' }, { metadata_release_id: 'old-2' }, { metadata_release_id: 'extra' }]]) {
    const events = []; const query = createProjectionQuery(t, { targets: ['old-1', 'old-2'], deletedRows, events }); const release = t.mock.fn();
    await assert.rejects(standaloneStore(query, release).replaceLibraryReleaseReconciliations({ reconciliations: [projectionRow()] }), { code: 'library_release_reconciliation_incomplete' });
    assert.equal(events.includes('upsert'), false); assert.equal(events.at(-1), 'ROLLBACK'); assert.equal(release.mock.callCount(), 1);
  }
});

test('exact bulk identity verification refuses zero, partial, duplicate and foreign results after deletion', async (t) => {
  for (const writtenRows of [[], [{ metadata_release_id: 'release-1' }], [{ metadata_release_id: 'release-1' }, { metadata_release_id: 'release-1' }],
    [{ metadata_release_id: 'release-1' }, { metadata_release_id: 'foreign' }]]) {
    const events = []; const query = createProjectionQuery(t, { targets: ['obsolete'], writtenRows, events }); const release = t.mock.fn();
    await assert.rejects(standaloneStore(query, release).replaceLibraryReleaseReconciliations({ reconciliations: [projectionRow(), projectionRow('release-2')] }), { code: 'library_release_reconciliation_incomplete' });
    assert.equal(events.includes('delete'), true); assert.equal(events.includes('upsert'), true);
    assert.equal(events.at(-1), 'ROLLBACK'); assert.equal(events.includes('COMMIT'), false); assert.equal(release.mock.callCount(), 1);
  }
});

test('malformed projection input, supplied client or guard refuses before borrowing or issuing SQL', async (t) => {
  const query = createProjectionQuery(t); const store = createLibraryReleaseReconciliationStore({ getPoolFn: () => { assert.fail('Unexpected connection'); } });
  for (const input of [{ reconciliations: null }, { reconciliations: [], queryable: { noQuery: true } },
    { reconciliations: [], queryable: { query }, beforeWrite: true }]) await assert.rejects(store.replaceLibraryReleaseReconciliations(input), TypeError);
  assert.equal(query.mock.callCount(), 0);
});
