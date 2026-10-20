import assert from 'node:assert/strict';
import test from 'node:test';
import { buildOperationSearchRecovery } from '../../src/client/lib/operation-search-recovery-presentation.js';

test('shared discovery failures hand off to current Missing Music actions without granting new search authority', () => {
  for (const code of ['slskd_search_continuation_expired', 'slskd_search_continuation_unavailable']) {
    const result = buildOperationSearchRecovery({ operationType: 'library_discovery_dispatch', status: 'completed',
      summary: { failures: [{ code, message: 'Private provider /mnt/data', metadataReleaseId: 'private-id' }] } });
    assert.deepEqual(result.to, { path: '/app/missing', query: { state: 'action' } });
    assert.match(result.message, /choose Search again/);
    assert.doesNotMatch(JSON.stringify(result), /private-id|Private provider|\/mnt\/data/);
  }
  for (const run of [null, { operationType: 'library_discovery_dispatch', summary: { failures: {} } },
    { operationType: 'library_discovery_dispatch', summary: { failures: [{ code: 'unknown' }] } },
    { operationType: 'library_external_request_discovery', summary: { failures: [{ code: 'slskd_search_continuation_expired' }] } }]) {
    assert.equal(buildOperationSearchRecovery(run), null);
  }
});
