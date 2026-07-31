import assert from 'node:assert/strict';
import test from 'node:test';
import { createImportCandidateReleaseAddDiagnosticRepository } from '../../src/server/import-candidates/import-candidate-release-add-diagnostic-repository.js';

test('release add diagnostic repository scopes durable outcomes through stored Music Queue context', async (t) => {
  const queryable = {
    query: t.mock.fn(async (sql) => ({
      rows: sql.includes('FROM library_wanted_releases')
        ? [{
          artist_name: 'Forest Frank',
          id: '8f28e363-3187-48c1-bd48-0b1b613f6c9d',
          release_title: 'Child of God',
        }]
        : [{
          apply_snapshot: { apply: { outcome: 'quality_blocked' } },
          import_candidate_id: 'candidate-1',
          item_status: 'blocked',
          updated_at: '2026-07-31T16:10:00.000Z',
        }],
    })),
  };
  const repository = createImportCandidateReleaseAddDiagnosticRepository();

  const release = await repository.getScopedWantedRelease({
    appUserId: 'c5c86d81-f611-49f6-b55e-cf617f5a842f',
    wantedReleaseId: '8f28e363-3187-48c1-bd48-0b1b613f6c9d',
  }, queryable);
  const outcomes = await repository.listLatestReleaseAddOutcomes({
    limit: 10,
    wantedReleaseId: '8f28e363-3187-48c1-bd48-0b1b613f6c9d',
  }, queryable);

  const [releaseSql, releaseValues] = queryable.query.mock.calls[0].arguments;
  const [outcomeSql, outcomeValues] = queryable.query.mock.calls[1].arguments;
  assert.match(releaseSql, /lwr\.id = \$1::uuid/);
  assert.match(releaseSql, /lwr\.app_user_id = \$2::uuid/);
  assert.deepEqual(releaseValues, [
    '8f28e363-3187-48c1-bd48-0b1b613f6c9d',
    'c5c86d81-f611-49f6-b55e-cf617f5a842f',
  ]);
  assert.match(outcomeSql, /DISTINCT ON \(apply_items\.import_candidate_id\)/);
  assert.match(outcomeSql, /wantedReleaseIds/);
  assert.match(outcomeSql, /LIMIT \$2/);
  assert.doesNotMatch(outcomeSql, /status_message/);
  assert.deepEqual(outcomeValues, ['8f28e363-3187-48c1-bd48-0b1b613f6c9d', 10]);
  assert.deepEqual(release, {
    artistName: 'Forest Frank',
    id: '8f28e363-3187-48c1-bd48-0b1b613f6c9d',
    releaseTitle: 'Child of God',
  });
  assert.deepEqual(outcomes, [{
    applySnapshot: { apply: { outcome: 'quality_blocked' } },
    importCandidateId: 'candidate-1',
    itemStatus: 'blocked',
    updatedAt: '2026-07-31T16:10:00.000Z',
  }]);
});
