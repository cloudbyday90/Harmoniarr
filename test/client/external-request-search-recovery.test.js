import assert from 'node:assert/strict';
import test from 'node:test';
import { ref } from 'vue';
import { useExternalRequestSearchRecovery } from '../../src/client/composables/useExternalRequestSearchRecovery.js';
import { createRetryIdempotencyKeyStore } from '../../src/client/lib/retry-idempotency-key-store.js';
import { buildOperationSearchRecovery } from '../../src/client/lib/operation-search-recovery-presentation.js';
import { canRequestOperationRunRetry } from '../../src/shared/operation-run-descriptors.js';

const result = input => ({ searchRecovery: { outcome: 'queued', ...input, previousOperationRunId: input.expectedOperationRunId, operationRunId: 'new-run' } });

test('uncertain submission retains the exact intent, old run and key across a changed read projection', async t => {
  const calls = []; let keys = 0;
  const command = useExternalRequestSearchRecovery({ mediaRequestId: 'request', recipientId: 'target', intentId: 'intent',
    retryKeys: createRetryIdempotencyKeyStore({ createIdempotencyKey: () => `key-${++keys}` }),
    execute: async input => { calls.push(input); if (calls.length === 1) throw new Error('private /mnt/provider'); return result(input); } });
  t.after(command.destroy);
  assert.equal(await command.searchAgain({ expectedOperationRunId: 'old-run' }), null);
  assert.equal(command.hasUncertainIntent.value, true);
  assert.doesNotMatch(command.errorMessage.value, /private|\/mnt/);
  assert.ok(await command.searchAgain({ expectedOperationRunId: 'changed-read-run' }));
  assert.deepEqual(calls[0], calls[1]); assert.equal(keys, 1);
  assert.equal(command.hasUncertainIntent.value, false);
  assert.match(command.statusMessage.value, /queued/);
});

test('single flight, recipient replacement and disposal prevent stale feedback or competing intent', async t => {
  let finish; let entered;
  const waiting = new Promise(done => { finish = done; }); const started = new Promise(done => { entered = done; });
  const recipientId = ref('target'); let calls = 0;
  const command = useExternalRequestSearchRecovery({ mediaRequestId: 'request', recipientId, intentId: 'intent',
    execute: async input => { calls++; entered(); await waiting; return result(input); } });
  t.after(command.destroy);
  const pending = command.searchAgain({ expectedOperationRunId: 'old-run' }); await started;
  assert.equal(await command.searchAgain({ expectedOperationRunId: 'another-run' }), null);
  recipientId.value = 'replacement'; finish();
  assert.equal(await pending, null); assert.equal(calls, 1); assert.equal(command.statusMessage.value, '');
  command.destroy(); assert.equal(await command.searchAgain({ expectedOperationRunId: 'old-run' }), null);
});

test('definite refusal clears the retry key and an invalid response remains uncertain', async t => {
  let calls = 0; const seen = []; let keys = 0;
  const command = useExternalRequestSearchRecovery({ mediaRequestId: 'request', recipientId: 'target', intentId: 'intent',
    retryKeys: createRetryIdempotencyKeyStore({ createIdempotencyKey: () => `key-${++keys}` }), execute: async input => {
      seen.push(input); calls++; if (calls === 1) throw Object.assign(new Error('private'), { status: 409 });
      return { searchRecovery: { ...result(input).searchRecovery, intentId: 'another-intent' } };
    } });
  t.after(command.destroy);
  await command.searchAgain({ expectedOperationRunId: 'old-run' });
  assert.equal(command.hasUncertainIntent.value, false);
  await command.searchAgain({ expectedOperationRunId: 'new-failed-run' });
  assert.notEqual(seen[0].idempotencyKey, seen[1].idempotencyKey);
  assert.equal(command.hasUncertainIntent.value, true); assert.doesNotMatch(command.errorMessage.value, /private/);
});

test('external failed jobs link to current request review and superseded runs cannot be retried', () => {
  const run = { operationType: 'library_external_request_discovery', status: 'failed', summary: {
    failureCode: 'slskd_search_continuation_expired', mediaRequestId: '10000000-0000-4000-8000-000000000001' } };
  assert.equal(buildOperationSearchRecovery(run).to.path, '/app/requests/10000000-0000-4000-8000-000000000001');
  assert.equal(canRequestOperationRunRetry(run), true);
  const superseded = { ...run, summary: { ...run.summary, externalSearchSuperseded: true } };
  assert.equal(canRequestOperationRunRetry(superseded), false); assert.equal(buildOperationSearchRecovery(superseded), null);
  assert.equal(buildOperationSearchRecovery({ ...run, status: 'completed' }), null);
  assert.equal(buildOperationSearchRecovery({ ...run, summary: { ...run.summary, mediaRequestId: '/arbitrary' } }), null);
});
