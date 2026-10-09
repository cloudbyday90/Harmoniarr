import assert from 'node:assert/strict';
import test from 'node:test';
import { effectScope, nextTick, ref } from 'vue';
import { useImportReviewAdminWorkflow } from '../../src/client/composables/useImportReviewAdminWorkflow.js';
import { canStartExecutionRun } from '../../src/client/lib/import-candidate-presentation.js';

test('download review completion refreshes current execution and selected matches without navigating or scrolling', async (t) => {
  const scope = effectScope(); t.after(() => scope.stop());
  const selectedCount = ref(1); const summary = ref({ confirmationPending: true }); const currentRun = ref({ id: 'earlier', status: 'failed', items: [] });
  let restored = false; let executionReads = 0; let queueReads = 0; let navigations = 0;
  const workflow = scope.run(() => useImportReviewAdminWorkflow({
    isAdmin: true, selectedCandidateCount: selectedCount, importPendingCandidateCount: 0,
    route: { query: { executionRunId: 'earlier', candidate: 'candidate' }, hash: '#import-execution-run-panel' },
    router: { replace: async () => { navigations += 1; } }, onPanelNavigate: () => { navigations += 1; },
    executionSummaryWorkflow: { selectedRunId: ref(null), currentRun, summary,
      loadImportCandidateExecutionSummary: async ({ preferredRunId }) => {
        assert.equal(preferredRunId, 'earlier'); executionReads += 1;
        summary.value = { confirmationPending: !restored }; currentRun.value = { id: 'earlier', status: 'failed', items: [] };
      } },
    mediaInspectionSummaryWorkflow: { selectedRunId: ref(null), loadImportCandidateMediaInspectionSummary: async () => {} },
    applySummaryWorkflow: { selectedRunId: ref(null), loadImportCandidateApplySummary: async () => {} },
    refreshQueue: async ({ preserveSelection }) => { assert.equal(preserveSelection, true); queueReads += 1; selectedCount.value = restored ? 0 : 1; },
  }));
  await nextTick(); await nextTick(); executionReads = 0; navigations = 0;
  assert.equal(canStartExecutionRun(currentRun.value, selectedCount.value, summary.value), false);
  restored = true; await workflow.execution.handleDownloadReviewCompleted(); await nextTick();
  assert.ok(executionReads >= 1); assert.equal(queueReads, 1); assert.equal(summary.value.confirmationPending, false);
  assert.equal(selectedCount.value, 0); assert.equal(canStartExecutionRun(currentRun.value, selectedCount.value, summary.value), false,
    'the confirmed progress refresh must not enable another download run using stale selected counts');
  assert.equal(navigations, 0, 'completion leaves user-owned navigation, focus and scroll to the component');
});
