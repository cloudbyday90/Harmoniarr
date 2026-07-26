import assert from 'node:assert/strict';
import test from 'node:test';
import { reactive } from 'vue';
import { useImportCandidateApplyPreview } from '../../src/client/composables/useImportCandidateApplyPreview.js';
import { useImportCandidatePreview } from '../../src/client/composables/useImportCandidatePreview.js';
import { useImportPendingCandidateSummary } from '../../src/client/composables/useImportPendingCandidateSummary.js';
import { useImportReviewQueue } from '../../src/client/composables/useImportReviewQueue.js';
import { useImportReviewWorkspace } from '../../src/client/composables/useImportReviewWorkspace.js';
import { useSelectedImportCandidateSummary } from '../../src/client/composables/useSelectedImportCandidateSummary.js';

function createQueuePayload(candidates, total = candidates.length) {
  return {
    importCandidates: {
      candidates,
      filters: {
        folderPath: null,
        sourceSearchId: null,
        status: 'pending',
        username: null,
      },
      pagination: {
        limit: 25,
        offset: 0,
        total,
      },
    },
  };
}

function createCandidate(id, overrides = {}) {
  return {
    id,
    username: 'source-user',
    folderPath: `Folder ${id}`,
    sourceProvider: 'slskd',
    sourceSearchId: 'search-1',
    status: 'pending',
    fileCount: 2,
    lockedFileCount: 0,
    totalSizeBytes: 4096,
    normalizedPayload: {
      extensions: ['flac'],
    },
    files: [{
      id: `file-${id}`,
      filename: `${id}.flac`,
      folderPath: `Folder ${id}`,
      extension: 'flac',
      sizeBytes: 4096,
      lengthSeconds: 240,
      bitRateKbps: 900,
      isLocked: false,
    }],
    ...overrides,
  };
}

test('useImportReviewWorkspace syncs route filters, candidate detail, preview, and route backfill through shared workflows', async (t) => {
  const candidate = createCandidate('candidate-1');
  const route = reactive({
    query: {
      folderPath: '  Amber ',
      sourceSearchId: ' search-1 ',
      status: 'pending',
      username: ' source-user ',
    },
  });
  const replaceRoute = t.mock.fn(async () => {});
  const listCandidates = t.mock.fn(async (filters) => createQueuePayload([
    { ...candidate, files: undefined },
  ]));
  const fetchCandidate = t.mock.fn(async (importCandidateId) => ({
    importCandidate: {
      ...candidate,
      id: importCandidateId,
    },
  }));
  const fetchPreview = t.mock.fn(async (importCandidateId) => ({
    importCandidatePreview: {
      candidate: { id: importCandidateId },
      validation: {
        blockers: [],
        canPreview: true,
        warnings: [],
      },
    },
  }));
  const fetchApplyPreview = t.mock.fn(async () => ({
    importCandidateApplyPreview: {
      summary: {
        status: 'ready',
        message: '1 file is ready.',
      },
    },
  }));
  const fetchSelectedSummary = t.mock.fn(async () => ({
    selectedImportCandidates: {
      counts: {
        blocked: 0,
        ready: 1,
        readyWithWarnings: 0,
        totalSelected: 1,
      },
      selectedCandidates: [{ id: 'candidate-1' }],
      summary: {
        status: 'ready',
        message: '1 selected candidate is ready.',
      },
    },
  }));
  const fetchImportPendingSummary = t.mock.fn(async () => ({
    importPendingCandidates: {
      counts: {
        blocked: 0,
        ready: 0,
        readyWithWarnings: 0,
        totalImportPending: 0,
      },
      importPendingCandidates: [],
      summary: {
        status: 'empty',
        message: 'No completed downloads are waiting for import review yet.',
      },
    },
  }));

  const queueWorkflow = useImportReviewQueue({ fetchCandidate, listCandidates });
  const applyPreviewWorkflow = useImportCandidateApplyPreview({ fetchApplyPreview });
  const previewWorkflow = useImportCandidatePreview({ fetchPreview });
  const importPendingSummaryWorkflow = useImportPendingCandidateSummary({ fetchSummary: fetchImportPendingSummary });
  const selectedSummaryWorkflow = useSelectedImportCandidateSummary({ fetchSummary: fetchSelectedSummary });
  const workspace = useImportReviewWorkspace({
    applyPreviewWorkflow,
    importPendingSummaryWorkflow,
    previewWorkflow,
    queueWorkflow,
    replaceRoute,
    route,
    selectedSummaryWorkflow,
  });

  await workspace.syncFromRoute({ preserveSelection: false });

  assert.deepEqual(listCandidates.mock.calls.at(-1).arguments, [{
    folderPath: 'Amber',
    limit: 25,
    offset: 0,
    sourceSearchId: 'search-1',
    status: 'pending',
    username: 'source-user',
  }]);
  assert.deepEqual(fetchCandidate.mock.calls.at(-1).arguments, ['candidate-1']);
  assert.deepEqual(fetchPreview.mock.calls.at(-1).arguments, ['candidate-1']);
  assert.equal(fetchApplyPreview.mock.callCount(), 0);
  assert.ok(fetchImportPendingSummary.mock.callCount() >= 1);
  assert.ok(fetchSelectedSummary.mock.callCount() >= 1);
  assert.equal(workspace.selectedCandidateId.value, 'candidate-1');
  assert.equal(workspace.preview.value.candidate.id, 'candidate-1');
  assert.equal(workspace.selectedSummaryCounts.value.totalSelected, 1);
  assert.equal(workspace.importPendingSummaryCounts.value.totalImportPending, 0);
  assert.deepEqual(replaceRoute.mock.calls.at(-1).arguments, [{
    name: 'activity-diagnostics-matches',
    query: {
      candidate: 'candidate-1',
      folderPath: 'Amber',
      sourceSearchId: 'search-1',
      username: 'source-user',
    },
  }]);
});

test('useImportReviewWorkspace refreshes queue state after transitions while preserving the transitioned detail', async (t) => {
  const firstCandidate = createCandidate('candidate-1');
  const heldCandidate = createCandidate('candidate-1', { status: 'held' });
  const secondCandidate = createCandidate('candidate-2', { folderPath: 'Folder candidate-2' });
  let queueRefreshCount = 0;
  const route = reactive({
    query: {
      candidate: 'candidate-1',
      status: 'pending',
    },
  });
  const replaceRoute = t.mock.fn(async () => {});
  const listCandidates = t.mock.fn(async () => {
    queueRefreshCount += 1;

    if (queueRefreshCount === 1) {
      return createQueuePayload([
        { ...firstCandidate, files: undefined },
        { ...secondCandidate, files: undefined },
      ], 2);
    }

    return createQueuePayload([
      { ...secondCandidate, files: undefined },
    ], 1);
  });
  const fetchCandidate = t.mock.fn(async (importCandidateId) => {
    if (importCandidateId === 'candidate-1') {
      return {
        importCandidate: queueRefreshCount > 1 ? heldCandidate : firstCandidate,
      };
    }

    return {
      importCandidate: secondCandidate,
    };
  });
  const holdCandidate = t.mock.fn(async (importCandidateId, reason) => ({
    review: {
      candidate: {
        id: importCandidateId,
        status: 'held',
      },
      event: {
        reason,
      },
    },
  }));
  const fetchPreview = t.mock.fn(async (importCandidateId) => ({
    importCandidatePreview: {
      candidate: { id: importCandidateId },
      validation: {
        blockers: [],
        canPreview: true,
        warnings: [],
      },
    },
  }));
  const fetchApplyPreview = t.mock.fn(async () => ({
    importCandidateApplyPreview: {
      summary: {
        status: 'ready',
        message: '1 file is ready.',
      },
    },
  }));
  const fetchSelectedSummary = t.mock.fn(async () => ({
    selectedImportCandidates: {
      counts: {
        blocked: 0,
        ready: 0,
        readyWithWarnings: 0,
        totalSelected: 0,
      },
      selectedCandidates: [],
      summary: {
        status: 'empty',
        message: 'No candidates are selected.',
      },
    },
  }));
  const fetchImportPendingSummary = t.mock.fn(async () => ({
    importPendingCandidates: {
      counts: {
        blocked: 0,
        ready: 0,
        readyWithWarnings: 0,
        totalImportPending: 0,
      },
      importPendingCandidates: [],
      summary: {
        status: 'empty',
        message: 'No completed downloads are waiting for import review yet.',
      },
    },
  }));

  const queueWorkflow = useImportReviewQueue({ fetchCandidate, holdCandidate, listCandidates });
  const applyPreviewWorkflow = useImportCandidateApplyPreview({ fetchApplyPreview });
  const previewWorkflow = useImportCandidatePreview({ fetchPreview });
  const importPendingSummaryWorkflow = useImportPendingCandidateSummary({ fetchSummary: fetchImportPendingSummary });
  const selectedSummaryWorkflow = useSelectedImportCandidateSummary({ fetchSummary: fetchSelectedSummary });
  const workspace = useImportReviewWorkspace({
    applyPreviewWorkflow,
    importPendingSummaryWorkflow,
    previewWorkflow,
    queueWorkflow,
    replaceRoute,
    route,
    selectedSummaryWorkflow,
  });

  await workspace.syncFromRoute({ preserveSelection: false });
  workspace.actionReason.value = 'Needs path mapping';

  await workspace.runHoldCandidate();

  assert.deepEqual(holdCandidate.mock.calls[0].arguments, ['candidate-1', 'Needs path mapping']);
  assert.ok(fetchImportPendingSummary.mock.callCount() >= 2);
  assert.ok(fetchSelectedSummary.mock.callCount() >= 2);
  assert.equal(workspace.selectedCandidateId.value, 'candidate-1');
  assert.equal(workspace.selectedCandidate.value.status, 'held');
  assert.equal(workspace.preview.value.candidate.id, 'candidate-1');
  assert.equal(workspace.selectedSummaryCounts.value.totalSelected, 0);
  assert.equal(workspace.importPendingSummaryCounts.value.totalImportPending, 0);
  assert.equal(replaceRoute.mock.callCount(), 0);
  assert.equal(route.query.candidate, 'candidate-1');
});

test('useImportReviewWorkspace clears diagnostic file focus when selecting a different queue candidate', async (t) => {
  const candidate = createCandidate('candidate-1');
  const route = reactive({
    hash: '#import-review-selection-stage',
    query: {
      candidate: 'candidate-1',
      candidateFile: 'file-candidate-1',
      mediaInspectionRunId: 'media-run-1',
      status: 'pending',
    },
  });
  const replaceRoute = t.mock.fn(async (location) => {
    route.query = { ...location.query };
  });

  const workspace = useImportReviewWorkspace({
    previewWorkflow: useImportCandidatePreview({
      fetchPreview: async (importCandidateId) => ({
        importCandidatePreview: {
          candidate: { id: importCandidateId },
          validation: {
            blockers: [],
            canPreview: true,
            warnings: [],
          },
        },
      }),
    }),
    queueWorkflow: useImportReviewQueue({
      fetchCandidate: async (importCandidateId) => ({ importCandidate: createCandidate(importCandidateId) }),
      listCandidates: async () => createQueuePayload([
        { ...candidate, files: undefined },
        { ...createCandidate('candidate-2'), files: undefined },
      ], 2),
    }),
    replaceRoute,
    route,
  });

  await workspace.syncFromRoute({ preserveSelection: false });
  await workspace.openCandidate('candidate-2');

  assert.deepEqual(replaceRoute.mock.calls.at(-1).arguments[0], {
    hash: '#import-review-selection-stage',
    name: 'activity-diagnostics-matches',
    query: {
      candidate: 'candidate-2',
      mediaInspectionRunId: 'media-run-1',
    },
  });
});

test('useImportReviewWorkspace leaves selection and summaries stable when a transition fails', async (t) => {
  const candidate = createCandidate('candidate-1', { status: 'failed' });
  const route = reactive({
    query: {
      candidate: 'candidate-1',
      status: 'failed',
    },
  });
  const replaceRoute = t.mock.fn(async () => {});
  const listCandidates = t.mock.fn(async () => createQueuePayload([
    { ...candidate, files: undefined },
  ], 1));
  const fetchCandidate = t.mock.fn(async () => ({ importCandidate: candidate }));
  const reopenCandidate = t.mock.fn(async () => {
    throw new Error('Recovery is temporarily locked.');
  });
  const fetchPreview = t.mock.fn(async (importCandidateId) => ({
    importCandidatePreview: {
      candidate: { id: importCandidateId },
      validation: {
        blockers: [],
        canPreview: true,
        warnings: [],
      },
    },
  }));
  const fetchSelectedSummary = t.mock.fn(async () => ({
    selectedImportCandidates: {
      counts: {
        blocked: 0,
        ready: 0,
        readyWithWarnings: 0,
        totalSelected: 0,
      },
      selectedCandidates: [],
      summary: {
        status: 'empty',
        message: 'No candidates are selected.',
      },
    },
  }));
  const fetchImportPendingSummary = t.mock.fn(async () => ({
    importPendingCandidates: {
      counts: {
        blocked: 0,
        ready: 0,
        readyWithWarnings: 0,
        totalImportPending: 0,
      },
      importPendingCandidates: [],
      summary: {
        status: 'empty',
        message: 'No completed downloads are waiting for import review yet.',
      },
    },
  }));

  const workspace = useImportReviewWorkspace({
    importPendingSummaryWorkflow: useImportPendingCandidateSummary({ fetchSummary: fetchImportPendingSummary }),
    previewWorkflow: useImportCandidatePreview({ fetchPreview }),
    queueWorkflow: useImportReviewQueue({ fetchCandidate, listCandidates, reopenCandidate }),
    replaceRoute,
    route,
    selectedSummaryWorkflow: useSelectedImportCandidateSummary({ fetchSummary: fetchSelectedSummary }),
  });

  await workspace.syncFromRoute({ preserveSelection: false });
  const previewLoadCount = fetchPreview.mock.callCount();
  const selectedSummaryLoadCount = fetchSelectedSummary.mock.callCount();
  const importPendingSummaryLoadCount = fetchImportPendingSummary.mock.callCount();
  const routeReplaceCount = replaceRoute.mock.callCount();

  const result = await workspace.runReopenCandidate();

  assert.equal(result, null);
  assert.equal(reopenCandidate.mock.callCount(), 1);
  assert.equal(workspace.selectedCandidateId.value, 'candidate-1');
  assert.equal(workspace.selectedCandidate.value.status, 'failed');
  assert.equal(workspace.actionError.value, 'Recovery is temporarily locked.');
  assert.equal(workspace.actionStatus.value, '');
  assert.equal(fetchPreview.mock.callCount(), previewLoadCount);
  assert.equal(fetchSelectedSummary.mock.callCount(), selectedSummaryLoadCount);
  assert.equal(fetchImportPendingSummary.mock.callCount(), importPendingSummaryLoadCount);
  assert.equal(replaceRoute.mock.callCount(), routeReplaceCount);
});

test('useImportReviewWorkspace loads apply preview for import-pending candidates', async () => {
  const importPendingCandidate = createCandidate('candidate-1', { status: 'import_pending' });
  const route = reactive({
    query: {
      candidate: 'candidate-1',
      status: 'import_pending',
    },
  });
  const replaceRoute = async () => {};
  const fetchApplyPreview = async () => ({
    importCandidateApplyPreview: {
      summary: {
        status: 'blocked',
        message: '1 collision exists.',
      },
    },
  });
  const workspace = useImportReviewWorkspace({
    applyPreviewWorkflow: useImportCandidateApplyPreview({ fetchApplyPreview }),
    importPendingSummaryWorkflow: useImportPendingCandidateSummary({
      fetchSummary: async () => ({
        importPendingCandidates: {
          counts: {
            blocked: 1,
            ready: 0,
            readyWithWarnings: 0,
            totalImportPending: 1,
          },
          importPendingCandidates: [{ id: 'candidate-1' }],
          summary: {
            status: 'blocked',
            message: '1 completed download candidate is blocked.',
          },
        },
      }),
    }),
    previewWorkflow: useImportCandidatePreview({
      fetchPreview: async () => ({
        importCandidatePreview: {
          candidate: { id: 'candidate-1' },
          validation: {
            blockers: [],
            canPreview: true,
            warnings: [],
          },
        },
      }),
    }),
    queueWorkflow: useImportReviewQueue({
      fetchCandidate: async () => ({ importCandidate: importPendingCandidate }),
      listCandidates: async () => createQueuePayload([{ ...importPendingCandidate, files: undefined }], 1),
    }),
    replaceRoute,
    route,
    selectedSummaryWorkflow: useSelectedImportCandidateSummary({
      fetchSummary: async () => ({
        selectedImportCandidates: {
          counts: {
            blocked: 0,
            ready: 0,
            readyWithWarnings: 0,
            totalSelected: 0,
          },
          selectedCandidates: [],
          summary: {
            status: 'empty',
            message: 'No candidates are selected.',
          },
        },
      }),
    }),
  });

  await workspace.syncFromRoute({ preserveSelection: false });

  assert.equal(workspace.applyPreview.value.summary.status, 'blocked');
});
