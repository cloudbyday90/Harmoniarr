import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildOperationRunLinkTarget,
  buildOperationRunLinkTargetFromEvent,
  buildOperationRunLinkTargetFromReleasePresentation,
  canRequestOperationRunCancellation,
  canRequestOperationRunRetry,
  getOperationRunDescriptor,
} from '../../src/client/lib/operation-run-link-targets.js';

test('operation run link targets resolve shared descriptors by operation type', () => {
  assert.deepEqual(getOperationRunDescriptor('library_scan'), {
    operationType: 'library_scan',
    openLabel: 'View library scan',
    title: 'Library scan',
  });
  assert.deepEqual(buildOperationRunLinkTarget({ operationType: 'library_scan', runId: 'run-11' }), {
    label: 'View library scan',
    to: {
      hash: '#library-scan-panel',
      name: 'dashboard',
      query: {
        libraryScanRunId: 'run-11',
      },
    },
  });
  assert.deepEqual(buildOperationRunLinkTarget({ operationType: 'backup_restore_apply', runId: 'restore-run-1' }), {
    label: 'View backup restore',
    to: {
      name: 'jobs',
      query: {
        runId: 'restore-run-1',
      },
    },
  });
  assert.deepEqual(buildOperationRunLinkTarget({ operationType: 'library_organize_apply', runId: 'organize-run-1' }), {
    label: 'View organize apply',
    to: {
      name: 'jobs',
      query: {
        runId: 'organize-run-1',
      },
    },
  });
});

test('operation run link targets resolve shared descriptors by started event type', () => {
  assert.deepEqual(buildOperationRunLinkTargetFromEvent({
    entityId: 'run-44',
    eventType: 'import_candidate_execution_started',
  }), {
    label: 'View download run',
    to: {
      hash: '#import-execution-run-panel',
      name: 'review-queue',
      query: {
        executionRunId: 'run-44',
      },
    },
  });
  assert.deepEqual(buildOperationRunLinkTargetFromEvent({
    entityId: 'restore-run-1',
    eventType: 'backup_restore_failed',
  }), {
    label: 'View backup restore',
    to: {
      name: 'jobs',
      query: {
        runId: 'restore-run-1',
      },
    },
  });
});

test('operation run descriptors preserve fallback behavior for unknown operations', () => {
  assert.deepEqual(getOperationRunDescriptor('metadata_refresh'), {
    operationType: 'metadata_refresh',
    openLabel: 'Open run',
    title: 'Metadata Refresh',
  });
  assert.equal(buildOperationRunLinkTarget({ operationType: 'metadata_refresh', runId: 'run-99' }), null);
});

test('operation run link targets resolve release presentation source metadata', () => {
  assert.deepEqual(buildOperationRunLinkTargetFromReleasePresentation({
    source: {
      operationType: 'import_candidate_apply',
      runId: 'apply-run-1',
    },
  }), {
    label: 'View library import',
    to: {
      hash: '#import-apply-run-panel',
      name: 'review-queue',
      query: {
        applyRunId: 'apply-run-1',
      },
    },
  });
  assert.equal(buildOperationRunLinkTargetFromReleasePresentation({ source: null }), null);
});

test('operation run descriptor helpers centralize cancel and retry capability checks', () => {
  assert.equal(canRequestOperationRunCancellation({
    cancelRequestedAt: null,
    cancelledAt: null,
    operationType: 'library_scan',
    status: 'running',
  }), true);
  assert.equal(canRequestOperationRunCancellation({
    cancelRequestedAt: '2026-05-01T00:02:00.000Z',
    cancelledAt: null,
    operationType: 'library_scan',
    status: 'running',
  }), false);
  assert.equal(canRequestOperationRunRetry({
    operationType: 'artwork_cleanup',
    status: 'failed',
  }), true);
  assert.equal(canRequestOperationRunRetry({
    operationType: 'artwork_cleanup',
    status: 'pending',
  }), false);
  assert.equal(canRequestOperationRunRetry({
    operationType: 'metadata_refresh',
    status: 'failed',
  }), false);
});
