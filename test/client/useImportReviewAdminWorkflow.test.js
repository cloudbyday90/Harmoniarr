import assert from 'node:assert/strict';
import test from 'node:test';
import { reactive, ref } from 'vue';
import { useImportReviewAdminWorkflow } from '../../src/client/composables/useImportReviewAdminWorkflow.js';

function createSummaryWorkflow(overrides = {}) {
  return {
    actionErrorMessage: ref(''),
    currentRun: ref(null),
    errorMessage: ref(''),
    isLoading: ref(false),
    isStarting: ref(false),
    loadImportCandidateApplySummary: async () => {},
    loadImportCandidateExecutionSummary: async () => {},
    loadImportCandidateMediaInspectionSummary: async () => {},
    recentRuns: ref([]),
    runDetailErrorMessage: ref(''),
    selectedRunId: ref(null),
    startApplyRun: async () => {},
    startExecutionRun: async () => {},
    startMediaInspectionRun: async () => {},
    reconcileExecutionState: async () => {},
    summary: ref(null),
    ...overrides,
  };
}

test('useImportReviewAdminWorkflow refreshes stage summaries for admins and syncs preferred run selection from route state', async (t) => {
  const route = reactive({
    hash: '',
    query: {
      executionRunId: 'run-44',
    },
  });
  const replace = t.mock.fn(async (location) => {
    route.hash = location.hash ?? '';
    route.query = { ...location.query };
  });
  const selectedCandidateCount = ref(2);
  const importPendingCandidateCount = ref(1);
  const executionLoads = [];
  const mediaLoads = [];
  const applyLoads = [];
  const focusedPanels = [];

  const workflow = useImportReviewAdminWorkflow({
    applySummaryWorkflow: createSummaryWorkflow({
      loadImportCandidateApplySummary: async (options) => {
        applyLoads.push(options ?? null);
      },
      selectedRunId: ref(null),
      startApplyRun: async () => {},
    }),
    executionSummaryWorkflow: createSummaryWorkflow({
      loadImportCandidateExecutionSummary: async (options) => {
        executionLoads.push(options ?? null);
      },
      reconcileExecutionState: async () => {},
      selectedRunId: ref(null),
      startExecutionRun: async () => {},
    }),
    importPendingCandidateCount,
    isAdmin: ref(true),
    mediaInspectionSummaryWorkflow: createSummaryWorkflow({
      loadImportCandidateMediaInspectionSummary: async (options) => {
        mediaLoads.push(options ?? null);
      },
      selectedRunId: ref(null),
      startMediaInspectionRun: async () => {},
    }),
    onPanelNavigate: async (panelId) => {
      focusedPanels.push(panelId);
    },
    refreshQueue: async () => {},
    route,
    router: { replace },
    selectedCandidateCount,
  });

  await Promise.resolve();
  await Promise.resolve();

  assert.deepEqual(executionLoads[0], null);
  assert.deepEqual(mediaLoads[0], null);
  assert.deepEqual(applyLoads[0], null);
  assert.deepEqual(executionLoads.at(-1), { preferredRunId: 'run-44' });
  assert.equal(focusedPanels.at(-1), 'import-execution-run-panel');

  await workflow.execution.handleSelectRun('run-45');
  assert.deepEqual(replace.mock.calls.at(-1).arguments[0], {
    hash: '#import-execution-run-panel',
    query: {
      executionRunId: 'run-45',
    },
  });
});

test('useImportReviewAdminWorkflow start handlers update route state and refresh the queue', async (t) => {
  const route = reactive({
    hash: '',
    query: {
      candidate: 'candidate-1',
      status: 'selected',
    },
  });
  const replace = t.mock.fn(async (location) => {
    route.hash = location.hash ?? '';
    route.query = { ...location.query };
  });
  const refreshQueue = t.mock.fn(async () => {});
  const executionStart = t.mock.fn(async () => {});
  const applyStart = t.mock.fn(async () => {});
  const inspectionStart = t.mock.fn(async () => {});

  const workflow = useImportReviewAdminWorkflow({
    applySummaryWorkflow: createSummaryWorkflow({
      startApplyRun: applyStart,
    }),
    executionSummaryWorkflow: createSummaryWorkflow({
      startExecutionRun: executionStart,
    }),
    importPendingCandidateCount: ref(1),
    isAdmin: ref(true),
    mediaInspectionSummaryWorkflow: createSummaryWorkflow({
      startMediaInspectionRun: inspectionStart,
    }),
    refreshQueue,
    route,
    router: { replace },
    selectedCandidateCount: ref(1),
  });

  await workflow.execution.handleStartRun();
  await workflow.mediaInspection.handleStartRun();
  await workflow.apply.handleStartRun();

  assert.equal(executionStart.mock.callCount(), 1);
  assert.equal(inspectionStart.mock.callCount(), 1);
  assert.equal(applyStart.mock.callCount(), 1);
  assert.equal(refreshQueue.mock.callCount(), 3);
  assert.deepEqual(refreshQueue.mock.calls[0].arguments[0], { preserveSelection: true });
});
