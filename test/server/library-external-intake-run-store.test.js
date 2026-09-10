import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryExternalIntakeRunStore } from '../../src/server/library/library-external-intake-run-store.js';

for (const useTransaction of [false, true]) {
  test(`external intake run store creates and reads durable planning runs through ${useTransaction ? 'the caller transaction' : 'its default pool'}`, async (t) => {
    let savedRun = null;
    const query = t.mock.fn(async (sql, params) => {
      if (sql.includes('INSERT INTO operation_runs')) {
        savedRun = {
          id: 'planning-run',
          operation_type: params[0],
          status: params[1],
          summary: JSON.parse(params[3]),
        };
        return { rows: [savedRun] };
      }
      assert.match(sql, /summary->>'mediaRequestId' = \$2/);
      assert.equal(params[1], 'media-request');
      return { rows: savedRun ? [savedRun] : [] };
    });
    const queryable = { query };
    const getPoolFn = t.mock.fn(() => {
      assert.equal(useTransaction, false, 'Transaction-bound work must not escape to the pool');
      return queryable;
    });
    const store = createLibraryExternalIntakeRunStore({ getPoolFn });
    const transaction = useTransaction ? queryable : undefined;

    assert.equal(await store.getActiveRunByMediaRequestId('media-request', transaction), null);
    const run = await store.createOperationRun({
      canonicalUrl: 'https://open.spotify.com/playlist/abc',
      mediaRequestId: 'media-request',
      queryable: transaction,
      resourceType: 'playlist',
      sourceIdentifier: 'abc',
      sourceProvider: 'spotify',
      triggeredByUserId: 'admin',
    });
    const activeRun = await store.getActiveRunByMediaRequestId('media-request', transaction);

    assert.deepEqual(activeRun, run);
    assert.equal(run.mediaRequestId, 'media-request');
    assert.equal(run.sourceProvider, 'spotify');
    assert.equal(run.status, 'pending');
    assert.equal(run.triggerSource, 'request_submit');
    assert.equal(query.mock.callCount(), 3);
    assert.equal(getPoolFn.mock.callCount(), useTransaction ? 0 : 3);
    assert.equal(query.mock.calls[1].arguments[1][5], 3);
  });
}
