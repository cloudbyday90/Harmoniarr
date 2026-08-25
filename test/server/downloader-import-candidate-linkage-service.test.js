import assert from 'node:assert/strict';
import test from 'node:test';
import { createDownloaderImportCandidateLinkageService } from '../../src/server/downloader/downloader-import-candidate-linkage-service.js';

test('buildTransferImportCandidateLinkage returns bounded candidate linkage keyed by transfer', async (t) => {
  let observedSql = '';
  let observedParams = null;
  const pool = {
    query: t.mock.fn(async (sql, params) => {
      observedSql = sql;
      observedParams = params;
      return {
        rows: [{
          candidate_status: 'downloading',
          execution_item_status: 'queued',
          import_candidate_id: 'candidate-1',
          linked_at: new Date('2026-06-20T12:00:00.000Z'),
          operation_run_id: 'run-1',
          source_search_id: 'search-1',
          transfer_key: 'source-user::transfer-1',
        }],
      };
    }),
  };
  const service = createDownloaderImportCandidateLinkageService({
    getPoolFn: () => pool,
  });

  const linkage = await service.buildTransferImportCandidateLinkage({
    transfers: [{
      id: 'transfer-1',
      sourceUser: 'source-user',
      transferKey: 'source-user::transfer-1',
    }, {
      id: '',
      sourceUser: 'ignored',
      transferKey: 'ignored::missing',
    }],
  });

  assert.equal(pool.query.mock.callCount(), 1);
  assert.match(observedSql, /jsonb_to_recordset/);
  assert.match(observedSql, /import_execution_transfer_links AS links/);
  assert.match(observedSql, /JOIN import_execution_run_items AS iei/);
  assert.match(observedSql, /JOIN import_candidates AS ic/);
  assert.doesNotMatch(observedSql, /jsonb_array_elements/);
  assert.deepEqual(JSON.parse(observedParams[0]), [{
    id: 'transfer-1',
    transfer_key: 'source-user::transfer-1',
    username: 'source-user',
  }]);
  assert.deepEqual(linkage.get('source-user::transfer-1'), {
    candidateId: 'candidate-1',
    candidateStatus: 'downloading',
    executionItemStatus: 'queued',
    linkedAt: '2026-06-20T12:00:00.000Z',
    musicQueueRelease: null,
    operationRunId: 'run-1',
    sourceSearchId: 'search-1',
    status: 'linked',
    summary: 'Linked to Import Review candidate.',
  });
});

test('buildTransferImportCandidateLinkage composes a caller-scoped Music Queue release handoff', async (t) => {
  const pool = {
    query: t.mock.fn(async () => ({
      rows: [{
        candidate_status: 'downloading',
        execution_item_status: 'queued',
        import_candidate_id: 'candidate-1',
        linked_at: '2026-06-20T12:00:00.000Z',
        operation_run_id: 'run-1',
        source_search_id: 'search-1',
        transfer_key: 'source-user::transfer-1',
      }],
    })),
  };
  const buildCandidateMusicQueueReleaseLinkage = t.mock.fn(async ({ appUserId, candidateIds }) => {
    assert.equal(appUserId, 'admin-1');
    assert.deepEqual(candidateIds, ['candidate-1']);
    return new Map([['candidate-1', {
      artistName: 'Autechre',
      releaseTitle: 'Amber',
      wantedReleaseId: 'wanted-release-1',
      wantedStatus: 'missing',
    }]]);
  });
  const service = createDownloaderImportCandidateLinkageService({
    buildCandidateMusicQueueReleaseLinkage,
    getPoolFn: () => pool,
  });

  const linkage = await service.buildTransferImportCandidateLinkage({
    appUserId: 'admin-1',
    transfers: [{ id: 'transfer-1', sourceUser: 'source-user', transferKey: 'source-user::transfer-1' }],
  });

  assert.equal(buildCandidateMusicQueueReleaseLinkage.mock.callCount(), 1);
  assert.deepEqual(linkage.get('source-user::transfer-1').musicQueueRelease, {
    artistName: 'Autechre',
    releaseTitle: 'Amber',
    wantedReleaseId: 'wanted-release-1',
    wantedStatus: 'missing',
  });
});

test('buildTransferImportCandidateLinkage skips database lookup without matchable transfers', async (t) => {
  const pool = {
    query: t.mock.fn(async () => ({ rows: [] })),
  };
  const service = createDownloaderImportCandidateLinkageService({
    getPoolFn: () => pool,
  });

  const linkage = await service.buildTransferImportCandidateLinkage({
    transfers: [{ id: null, username: 'source-user', transferKey: 'source-user::missing' }],
  });

  assert.equal(pool.query.mock.callCount(), 0);
  assert.equal(linkage.size, 0);
});
