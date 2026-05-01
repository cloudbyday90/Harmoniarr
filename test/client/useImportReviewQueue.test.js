import assert from 'node:assert/strict';
import test from 'node:test';
import { useImportReviewQueue } from '../../src/client/composables/useImportReviewQueue.js';

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

test('useImportReviewQueue loads queue state and selected candidate detail from injected services', async (t) => {
  const candidate = createCandidate('candidate-1');
  const getNow = t.mock.fn(() => new Date('2026-04-30T15:00:00.000Z'));
  const listCandidates = t.mock.fn(async ({ status, limit, offset }) => createQueuePayload([
    {
      ...candidate,
      files: undefined,
    },
  ]));
  const fetchCandidate = t.mock.fn(async (importCandidateId) => ({
    importCandidate: {
      ...candidate,
      id: importCandidateId,
    },
  }));

  const workflow = useImportReviewQueue({
    fetchCandidate,
    getNow,
    listCandidates,
  });

  await workflow.loadQueue();
  await workflow.reconcileSelection({ fallbackToFirstCandidate: true, forceReload: true });

  assert.equal(listCandidates.mock.callCount(), 1);
  assert.deepEqual(listCandidates.mock.calls[0].arguments, [{
    folderPath: '',
    limit: 25,
    offset: 0,
    sourceSearchId: '',
    status: 'pending',
    username: '',
  }]);
  assert.equal(fetchCandidate.mock.callCount(), 1);
  assert.deepEqual(fetchCandidate.mock.calls[0].arguments, ['candidate-1']);
  assert.equal(workflow.listError.value, '');
  assert.equal(workflow.detailError.value, '');
  assert.equal(workflow.selectedCandidateId.value, 'candidate-1');
  assert.equal(workflow.selectedCandidate.value.id, 'candidate-1');
  assert.equal(workflow.pagination.value.total, 1);
  assert.equal(workflow.activeFilterCount.value, 1);
  assert.equal(workflow.lastLoadedAt.value, '2026-04-30T15:00:00.000Z');
});

test('useImportReviewQueue refreshes the queue after a review action and advances selection when filters exclude the transitioned candidate', async (t) => {
  const firstCandidate = createCandidate('candidate-1');
  const secondCandidate = createCandidate('candidate-2', { folderPath: 'Folder candidate-2' });
  let queueRefreshCount = 0;
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
  const fetchCandidate = t.mock.fn(async (importCandidateId) => ({
    importCandidate: importCandidateId === 'candidate-1' ? firstCandidate : secondCandidate,
  }));
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

  const workflow = useImportReviewQueue({
    fetchCandidate,
    holdCandidate,
    listCandidates,
  });

  await workflow.loadQueue();
  await workflow.selectCandidate('candidate-1');
  workflow.actionReason.value = 'Needs path mapping';

  await workflow.holdSelectedCandidate();

  assert.equal(holdCandidate.mock.callCount(), 1);
  assert.deepEqual(holdCandidate.mock.calls[0].arguments, ['candidate-1', 'Needs path mapping']);
  assert.equal(listCandidates.mock.callCount(), 2);
  assert.equal(fetchCandidate.mock.callCount(), 2);
  assert.deepEqual(fetchCandidate.mock.calls[1].arguments, ['candidate-2']);
  assert.equal(workflow.selectedCandidateId.value, 'candidate-2');
  assert.equal(workflow.selectedCandidate.value.id, 'candidate-2');
  assert.equal(workflow.actionReason.value, '');
  assert.equal(workflow.actionError.value, '');
});

test('useImportReviewQueue selects a candidate for download planning through the injected shared transition service', async (t) => {
  let candidateStatus = 'held';
  const candidate = createCandidate('candidate-1', { status: candidateStatus });
  const listCandidates = t.mock.fn(async () => createQueuePayload([{
    ...candidate,
    status: candidateStatus,
    files: undefined,
  }], 1));
  const fetchCandidate = t.mock.fn(async () => ({
    importCandidate: {
      ...candidate,
      status: candidateStatus,
    },
  }));
  const selectCandidateForDownload = t.mock.fn(async (importCandidateId, reason) => {
    candidateStatus = 'selected';

    return {
      review: {
        candidate: {
          id: importCandidateId,
          status: 'selected',
        },
        event: {
          reason,
        },
      },
    };
  });

  const workflow = useImportReviewQueue({
    fetchCandidate,
    listCandidates,
    selectCandidateForDownload,
  });

  await workflow.loadQueue();
  await workflow.selectCandidate('candidate-1');
  workflow.actionReason.value = 'Queue this candidate';

  await workflow.selectSelectedCandidate();

  assert.equal(selectCandidateForDownload.mock.callCount(), 1);
  assert.deepEqual(selectCandidateForDownload.mock.calls[0].arguments, ['candidate-1', 'Queue this candidate']);
  assert.equal(workflow.selectedCandidate.value.status, 'selected');
  assert.equal(workflow.actionError.value, '');
});

test('useImportReviewQueue trims filter input through the shared setter', async (t) => {
  const listCandidates = t.mock.fn(async (filters) => createQueuePayload([], 0));
  const workflow = useImportReviewQueue({ listCandidates });

  workflow.setFilters({
    folderPath: '  Amber ',
    sourceSearchId: ' search-1 ',
    status: ' held ',
    username: ' source-user ',
  });

  await workflow.loadQueue();

  assert.deepEqual(listCandidates.mock.calls[0].arguments, [{
    folderPath: 'Amber',
    limit: 25,
    offset: 0,
    sourceSearchId: 'search-1',
    status: 'held',
    username: 'source-user',
  }]);
});

test('useImportReviewQueue surfaces queue and action failures through shared error state', async () => {
  const workflow = useImportReviewQueue({
    holdCandidate: async () => {
      throw new Error('transition conflict');
    },
    listCandidates: async () => {
      throw new Error('queue offline');
    },
  });

  await workflow.loadQueue();
  workflow.selectedCandidateId.value = 'candidate-1';
  workflow.actionReason.value = 'Needs manual review';
  await workflow.holdSelectedCandidate();

  assert.equal(workflow.listError.value, 'queue offline');
  assert.equal(workflow.actionError.value, 'transition conflict');
  assert.equal(workflow.isLoadingQueue.value, false);
  assert.equal(workflow.isTransitionPending.value, false);
});

test('useImportReviewQueue preserves the last successful queue refresh time when a later load fails', async () => {
  let shouldFail = false;
  const workflow = useImportReviewQueue({
    getNow: () => new Date('2026-04-30T15:10:00.000Z'),
    listCandidates: async () => {
      if (shouldFail) {
        throw new Error('queue offline');
      }

      return createQueuePayload([], 0);
    },
  });

  await workflow.loadQueue();
  shouldFail = true;
  await workflow.loadQueue();

  assert.equal(workflow.lastLoadedAt.value, '2026-04-30T15:10:00.000Z');
});