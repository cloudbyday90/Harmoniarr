import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getImportCandidateById,
  insertImportCandidateEvent,
  listImportCandidateFiles,
  listImportCandidates,
  listImportCandidatesBySourceMediaRequestIds,
  replaceImportCandidateFiles,
  transitionImportCandidateStatus,
  upsertImportCandidate,
} from '../../src/server/import-candidates/import-candidate-repository.js';

test('listImportCandidates applies bounded filters and deterministic ordering', async (t) => {
  const queryable = {
    query: t.mock.fn(async (_sql, values) => ({
      rows: [{
        id: 'candidate-1',
        source_provider: 'slskd',
        source_search_id: values[1],
        source_response_key: 'response-key',
        username: 'source-user',
        folder_path: 'Autechre\\Amber',
        candidate_type: 'manual_search',
        status: values[0],
        file_count: 1,
        locked_file_count: 0,
        total_size_bytes: '123',
        raw_payload: { raw: true },
        normalized_payload: { normalized: true },
        discovered_at: '2026-04-30T14:00:00.000Z',
        created_at: '2026-04-30T14:00:00.000Z',
        updated_at: '2026-04-30T14:00:00.000Z',
        total_count: 1,
      }],
    })),
  };

  const result = await listImportCandidates({
    folderPath: 'Autechre\\Amber',
    limit: 25,
    offset: 0,
    requestedForUserId: 'user-7',
    sourceSearchId: 'search-1',
    status: 'pending',
    username: 'source_%',
  }, queryable);

  const [sql, values] = queryable.query.mock.calls[0].arguments;
  assert.match(sql, /status = \$1/);
  assert.match(sql, /source_search_id = \$2/);
  assert.match(sql, /username ILIKE \$3 ESCAPE/);
  assert.match(sql, /folder_path ILIKE \$4 ESCAPE/);
  assert.match(sql, /normalized_payload -> 'requestOwnership' ->> 'sourceRequestedForUserId' = \$5/);
  assert.match(sql, /ORDER BY discovered_at DESC, created_at DESC, id ASC/);
  assert.match(sql, /LIMIT \$6/);
  assert.match(sql, /OFFSET \$7/);
  assert.deepEqual(values, [
    'pending',
    'search-1',
    '%source\\_\\%%',
    '%Autechre\\\\Amber%',
    'user-7',
    25,
    0,
  ]);
  assert.equal(result.total, 1);
  assert.equal(result.items[0].id, 'candidate-1');
});

test('listImportCandidatesBySourceMediaRequestIds filters candidates by linked media request ids', async (t) => {
  const queryable = {
    query: t.mock.fn(async () => ({
      rows: [],
    })),
  };

  await listImportCandidatesBySourceMediaRequestIds(['request-1', 'request-2'], queryable);

  const [sql, values] = queryable.query.mock.calls[0].arguments;
  assert.match(sql, /normalized_payload -> 'requestOwnership' ->> 'sourceMediaRequestId' = ANY\(\$1::text\[\]\)/);
  assert.deepEqual(values, [['request-1', 'request-2']]);
});

test('getImportCandidateById maps a candidate row or null', async (t) => {
  const queryable = {
    query: t.mock.fn(async (_sql, values) => ({
      rows: values[0] === 'candidate-1'
        ? [{
            id: 'candidate-1',
            source_provider: 'slskd',
            source_search_id: 'search-1',
            source_response_key: 'response-key',
            username: 'source-user',
            folder_path: 'Autechre\\Amber',
            candidate_type: 'manual_search',
            status: 'pending',
            file_count: 1,
            locked_file_count: 0,
            total_size_bytes: '123',
            raw_payload: { raw: true },
            normalized_payload: { normalized: true },
            discovered_at: '2026-04-30T14:00:00.000Z',
            created_at: '2026-04-30T14:00:00.000Z',
            updated_at: '2026-04-30T14:00:00.000Z',
          }]
        : [],
    })),
  };

  assert.equal((await getImportCandidateById('candidate-1', queryable)).id, 'candidate-1');
  assert.equal(await getImportCandidateById('missing-candidate', queryable), null);
});

test('listImportCandidateFiles returns files in source order', async (t) => {
  const queryable = {
    query: t.mock.fn(async () => ({
      rows: [{
        id: 'file-1',
        import_candidate_id: 'candidate-1',
        source_file_index: 0,
        filename: '01 Foil.flac',
        folder_path: 'Autechre\\Amber',
        extension: 'flac',
        size_bytes: '123',
        bit_rate_kbps: 900,
        bit_depth: 16,
        length_seconds: 360,
        sample_rate_hz: 44100,
        is_locked: false,
        raw_payload: { filename: 'Autechre\\Amber\\01 Foil.flac' },
        created_at: '2026-04-30T14:00:00.000Z',
      }],
    })),
  };

  const files = await listImportCandidateFiles('candidate-1', queryable);

  assert.match(queryable.query.mock.calls[0].arguments[0], /ORDER BY source_file_index ASC/);
  assert.deepEqual(queryable.query.mock.calls[0].arguments[1], ['candidate-1']);
  assert.equal(files[0].filename, '01 Foil.flac');
});

test('transitionImportCandidateStatus updates candidates with an optimistic status guard', async (t) => {
  const queryable = {
    query: t.mock.fn(async (_sql, values) => ({
      rows: [{
        id: values[0],
        source_provider: 'slskd',
        source_search_id: 'search-1',
        source_response_key: 'response-key',
        username: 'source-user',
        folder_path: 'Autechre\\Amber',
        candidate_type: 'manual_search',
        status: values[1],
        file_count: 1,
        locked_file_count: 0,
        total_size_bytes: '123',
        raw_payload: { raw: true },
        normalized_payload: { normalized: true },
        discovered_at: '2026-04-30T14:00:00.000Z',
        created_at: '2026-04-30T14:00:00.000Z',
        updated_at: '2026-04-30T14:05:00.000Z',
      }],
    })),
  };

  const candidate = await transitionImportCandidateStatus({
    fromStatuses: ['pending'],
    importCandidateId: 'candidate-1',
    toStatus: 'held',
  }, queryable);

  const [sql, values] = queryable.query.mock.calls[0].arguments;
  assert.match(sql, /UPDATE import_candidates/);
  assert.match(sql, /status = ANY\(\$3::text\[\]\)/);
  assert.deepEqual(values, ['candidate-1', 'held', ['pending']]);
  assert.equal(candidate.status, 'held');
});

test('transitionImportCandidateStatus returns null when no row transitions', async (t) => {
  const queryable = {
    query: t.mock.fn(async () => ({ rows: [] })),
  };

  assert.equal(await transitionImportCandidateStatus({
    fromStatuses: ['pending'],
    importCandidateId: 'candidate-1',
    toStatus: 'held',
  }, queryable), null);
});

test('insertImportCandidateEvent writes append-only review history', async (t) => {
  const queryable = {
    query: t.mock.fn(async (_sql, values) => ({
      rows: [{
        id: 'event-1',
        import_candidate_id: values[0],
        event_type: values[1],
        previous_status: values[2],
        new_status: values[3],
        reason: values[4],
        actor_user_id: values[5],
        details: JSON.parse(values[6]),
        occurred_at: '2026-04-30T14:10:00.000Z',
        created_at: '2026-04-30T14:10:00.000Z',
      }],
    })),
  };

  const event = await insertImportCandidateEvent({
    actorUserId: 'user-1',
    details: {
      sourceProvider: 'slskd',
      sourceSearchId: 'search-1',
    },
    eventType: 'import_candidate_held',
    importCandidateId: 'candidate-1',
    newStatus: 'held',
    previousStatus: 'pending',
    reason: 'Needs review',
  }, queryable);

  assert.match(queryable.query.mock.calls[0].arguments[0], /INSERT INTO import_candidate_events/);
  assert.equal(queryable.query.mock.calls[0].arguments[1][6], '{"sourceProvider":"slskd","sourceSearchId":"search-1"}');
  assert.deepEqual(event, {
    id: 'event-1',
    importCandidateId: 'candidate-1',
    eventType: 'import_candidate_held',
    previousStatus: 'pending',
    newStatus: 'held',
    reason: 'Needs review',
    actorUserId: 'user-1',
    details: {
      sourceProvider: 'slskd',
      sourceSearchId: 'search-1',
    },
    occurredAt: '2026-04-30T14:10:00.000Z',
    createdAt: '2026-04-30T14:10:00.000Z',
  });
});

test('upsertImportCandidate writes normalized and raw payloads as jsonb', async (t) => {
  const queryable = {
    query: t.mock.fn(async (_sql, values) => ({
      rows: [{
        id: 'candidate-1',
        source_provider: values[0],
        source_search_id: values[1],
        source_response_key: values[2],
        username: values[3],
        folder_path: values[4],
        candidate_type: values[5],
        status: values[6],
        file_count: values[7],
        locked_file_count: values[8],
        total_size_bytes: String(values[9]),
        raw_payload: JSON.parse(values[10]),
        normalized_payload: JSON.parse(values[11]),
        discovered_at: values[12],
        created_at: '2026-04-30T14:00:00.000Z',
        updated_at: '2026-04-30T14:00:00.000Z',
      }],
    })),
  };

  const stored = await upsertImportCandidate({
    sourceProvider: 'slskd',
    sourceSearchId: 'search-1',
    sourceResponseKey: 'response-key',
    username: 'source-user',
    folderPath: 'Autechre\\Amber',
    candidateType: 'manual_search',
    status: 'pending',
    fileCount: 1,
    lockedFileCount: 0,
    totalSizeBytes: 123,
    rawPayload: { provider: 'raw' },
    normalizedPayload: { provider: 'normalized' },
    discoveredAt: '2026-04-30T14:00:00.000Z',
  }, queryable);

  assert.equal(queryable.query.mock.callCount(), 1);
  assert.match(queryable.query.mock.calls[0].arguments[0], /ON CONFLICT \(source_provider, source_search_id, source_response_key\)/);
  assert.equal(queryable.query.mock.calls[0].arguments[1][10], '{"provider":"raw"}');
  assert.equal(queryable.query.mock.calls[0].arguments[1][11], '{"provider":"normalized"}');
  assert.deepEqual(stored, {
    id: 'candidate-1',
    sourceProvider: 'slskd',
    sourceSearchId: 'search-1',
    sourceResponseKey: 'response-key',
    username: 'source-user',
    folderPath: 'Autechre\\Amber',
    candidateType: 'manual_search',
    status: 'pending',
    fileCount: 1,
    lockedFileCount: 0,
    totalSizeBytes: 123,
    rawPayload: { provider: 'raw' },
    normalizedPayload: { provider: 'normalized' },
    discoveredAt: '2026-04-30T14:00:00.000Z',
    createdAt: '2026-04-30T14:00:00.000Z',
    updatedAt: '2026-04-30T14:00:00.000Z',
  });
});

test('replaceImportCandidateFiles replaces prior files before inserting current candidate files', async (t) => {
  const queryable = {
    query: t.mock.fn(async (sql, values) => {
      if (/DELETE FROM import_candidate_files/.test(sql)) {
        return { rows: [] };
      }

      return {
        rows: [{
          id: `file-${values[1]}`,
          import_candidate_id: values[0],
          source_file_index: values[1],
          filename: values[2],
          folder_path: values[3],
          extension: values[4],
          size_bytes: String(values[5]),
          bit_rate_kbps: values[6],
          bit_depth: values[7],
          length_seconds: values[8],
          sample_rate_hz: values[9],
          is_locked: values[10],
          raw_payload: JSON.parse(values[11]),
          created_at: '2026-04-30T14:00:00.000Z',
        }],
      };
    }),
  };

  const stored = await replaceImportCandidateFiles('candidate-1', [{
    sourceFileIndex: 0,
    filename: '01 Foil.flac',
    folderPath: 'Autechre\\Amber',
    extension: 'flac',
    sizeBytes: 123,
    bitRateKbps: 900,
    bitDepth: 16,
    lengthSeconds: 360,
    sampleRateHz: 44100,
    isLocked: false,
    rawPayload: { filename: 'Autechre\\Amber\\01 Foil.flac' },
  }], queryable);

  assert.equal(queryable.query.mock.callCount(), 2);
  assert.match(queryable.query.mock.calls[0].arguments[0], /DELETE FROM import_candidate_files/);
  assert.equal(queryable.query.mock.calls[1].arguments[1][11], '{"filename":"Autechre\\\\Amber\\\\01 Foil.flac"}');
  assert.deepEqual(stored, [{
    id: 'file-0',
    importCandidateId: 'candidate-1',
    sourceFileIndex: 0,
    filename: '01 Foil.flac',
    folderPath: 'Autechre\\Amber',
    extension: 'flac',
    sizeBytes: 123,
    bitRateKbps: 900,
    bitDepth: 16,
    lengthSeconds: 360,
    sampleRateHz: 44100,
    isLocked: false,
    rawPayload: { filename: 'Autechre\\Amber\\01 Foil.flac' },
    createdAt: '2026-04-30T14:00:00.000Z',
  }]);
});
