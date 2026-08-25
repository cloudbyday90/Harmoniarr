import assert from 'node:assert/strict';
import test from 'node:test';
import { createDownloaderMusicQueueLinkageService } from '../../src/server/downloader/downloader-music-queue-linkage-service.js';

test('buildCandidateMusicQueueReleaseLinkage returns only the current administrator\'s persisted Music Queue release', async (t) => {
  let observedSql = '';
  let observedParams = null;
  const pool = {
    query: t.mock.fn(async (sql, params) => {
      observedSql = sql;
      observedParams = params;
      return {
        rows: [{
          artist_name: 'Autechre',
          import_candidate_id: '11111111-1111-4111-8111-111111111111',
          release_group_title: 'Amber',
          release_title: 'Amber',
          wanted_release_id: '22222222-2222-4222-8222-222222222222',
          wanted_status: 'missing',
        }],
      };
    }),
  };
  const service = createDownloaderMusicQueueLinkageService({ getPoolFn: () => pool });

  const result = await service.buildCandidateMusicQueueReleaseLinkage({
    appUserId: '33333333-3333-4333-8333-333333333333',
    candidateIds: ['11111111-1111-4111-8111-111111111111', '', '11111111-1111-4111-8111-111111111111'],
  });

  assert.equal(pool.query.mock.callCount(), 1);
  assert.match(observedSql, /import_candidates\.normalized_payload #>> '\{musicQueue,wantedReleaseId\}'/);
  assert.match(observedSql, /jsonb_array_elements_text/);
  assert.match(observedSql, /library_wanted_releases\.app_user_id = \$2::uuid/);
  assert.match(observedSql, /library_wanted_releases\.id::text = candidate_release_ids\.wanted_release_id/);
  assert.doesNotMatch(observedSql, /source_username|provider_transfer_id|raw_payload/);
  assert.deepEqual(JSON.parse(observedParams[0]), [{ candidate_id: '11111111-1111-4111-8111-111111111111' }]);
  assert.equal(observedParams[1], '33333333-3333-4333-8333-333333333333');
  assert.deepEqual(result.get('11111111-1111-4111-8111-111111111111'), {
    artistName: 'Autechre',
    releaseTitle: 'Amber',
    wantedReleaseId: '22222222-2222-4222-8222-222222222222',
    wantedStatus: 'missing',
  });
});

test('buildCandidateMusicQueueReleaseLinkage performs no lookup without a caller scope or candidate IDs', async (t) => {
  const pool = { query: t.mock.fn(async () => ({ rows: [] })) };
  const service = createDownloaderMusicQueueLinkageService({ getPoolFn: () => pool });

  assert.equal((await service.buildCandidateMusicQueueReleaseLinkage({
    candidateIds: ['11111111-1111-4111-8111-111111111111'],
  })).size, 0);
  assert.equal((await service.buildCandidateMusicQueueReleaseLinkage({
    appUserId: '33333333-3333-4333-8333-333333333333',
    candidateIds: [],
  })).size, 0);
  assert.equal(pool.query.mock.callCount(), 0);
});
