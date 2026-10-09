import assert from 'node:assert/strict';
import test from 'node:test';
import { createImportCandidateExecutionConfirmationWorklistStore } from '../../src/server/import-candidates/import-candidate-execution-confirmation-worklist-store.js';
import { createImportCandidateExecutionConfirmationWorklistService } from '../../src/server/import-candidates/import-candidate-execution-confirmation-worklist-service.js';

test('older confirmation worklist bounds hydration while counting all current unresolved requests', async () => {
  const calls = [];
  const store = createImportCandidateExecutionConfirmationWorklistStore({ getPoolFn: () => ({ query: async (sql, params) => {
    calls.push({ sql, params }); return { rows: [{ run_ids: ['older'], pending_confirmation_count: 24 }] };
  } }) });
  assert.deepEqual(await store.listUnconfirmedExecutionRuns({ excludeRunId: 'current', limit: 1000 }), { runIds: ['older'], pendingConfirmationCount: 24 });
  assert.deepEqual(calls[0].params, ['current', 20]);
  assert.match(calls[0].sql, /candidates.status = 'selected'/u);
  assert.equal(calls[0].sql.includes("<> 'not_dispatched'"), true);
  assert.equal(calls[0].sql.includes("handoff,state}' IN ('dispatching','awaiting_confirmation')"), true);
  assert.match(calls[0].sql, /MIN\(updated_at\)/u, 'pending updates rotate the least recently checked runs');
  assert.match(calls[0].sql, /LIMIT \$2/u);
});

test('older confirmation hydration dedupes current and old jobs and reconciles only unresolved items', async () => {
  const visited = [];
  const service = createImportCandidateExecutionConfirmationWorklistService({
    listUnconfirmedExecutionRuns: async (options) => { assert.deepEqual(options, { excludeRunId: 'current', limit: 20 });
      return { runIds: ['older', 'current', 'older', 'removed', 'planning'], pendingConfirmationCount: 8 }; },
    getRunById: async (id) => { visited.push(id); return id === 'removed' ? null : { id, executionMode: id === 'planning' ? 'planning_only' : 'download_enqueue' }; },
    buildRunWithItems: async (run) => ({ ...run, items: [{ id: 'uncertain', itemStatus: 'blocked', planningSnapshot: { execution: { handoff: { state: 'dispatching' } } } },
      { id: 'known-no-post', itemStatus: 'awaiting_confirmation', planningSnapshot: { execution: { handoff: { state: 'not_dispatched' } } } }, { id: 'old-complete', itemStatus: 'completed' }] }),
  });
  const result = await service.buildExecutionConfirmationWorklist({ currentRun: { id: 'current', items: [{ itemStatus: 'awaiting_confirmation' }] } });
  assert.deepEqual(visited, ['older', 'removed', 'planning']);
  assert.equal(result.unconfirmedRuns.length, 1);
  assert.deepEqual(result.unconfirmedRuns[0].items.map((item) => item.id), ['uncertain']);
  assert.equal(result.confirmationPending, true);
  assert.equal(result.pendingConfirmationCount, 9);
});

test('older confirmation worklist caps input and remains pending through a disappearing or already settled job', async () => {
  let hydrated = 0;
  const service = createImportCandidateExecutionConfirmationWorklistService({
    listUnconfirmedExecutionRuns: async () => ({ runIds: Array.from({ length: 50 }, (_, index) => `older-${index}`), pendingConfirmationCount: 50 }),
    getRunById: async (id) => ({ id, executionMode: 'download_enqueue' }),
    buildRunWithItems: async (run) => { hydrated += 1; return { ...run, items: [] }; },
  });
  const result = await service.buildExecutionConfirmationWorklist();
  assert.equal(hydrated, 20);
  assert.equal(result.pendingConfirmationCount, 50);
  assert.equal(result.confirmationPending, true);
  assert.deepEqual(result.unconfirmedRuns, []);
});
