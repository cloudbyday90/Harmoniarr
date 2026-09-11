import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryExternalRequestDiscoveryRunStore } from '../../src/server/library/library-external-request-discovery-run-store.js';

for (const useTransaction of [false, true]) {
  test(`external discovery intent is queued and found through ${useTransaction ? 'the approval transaction' : 'the pool'}`, async (t) => {
    let savedRun = null;
    const queryable = { query: t.mock.fn(async (sql, params) => {
      if (sql.includes('INSERT INTO operation_runs')) {
        assert.equal(params[0], 'library_external_request_discovery');
        assert.equal(params[5], 1, 'Search retries require an explicit operator action');
        savedRun = { id: 'run', status: params[1], summary: JSON.parse(params[3]) };
        return { rows: [savedRun] };
      }
      assert.match(sql, /summary->>'intentId' = \$2/);
      assert.equal(params[1], 'intent');
      return { rows: savedRun ? [savedRun] : [] };
    }) };
    const getPoolFn = t.mock.fn(() => {
      assert.equal(useTransaction, false, 'Approval writes cannot leave the caller transaction');
      return queryable;
    });
    const store = createLibraryExternalRequestDiscoveryRunStore({ getPoolFn });
    const transaction = useTransaction ? queryable : undefined;
    assert.equal(await store.getActiveRunByIntentId('intent', transaction), null);
    const run = await store.createOperationRun({ intentId: 'intent', mediaRequestId: 'request', queryable: transaction, triggeredByUserId: 'admin' });
    assert.deepEqual(run, { id: 'run', intentId: 'intent', mediaRequestId: 'request', status: 'pending', triggerSource: 'operator_review' });
    assert.deepEqual(await store.getActiveRunByIntentId('intent', transaction), run);
    assert.equal(getPoolFn.mock.callCount(), useTransaction ? 0 : 3);
  });
}
