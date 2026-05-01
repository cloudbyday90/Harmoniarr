import assert from 'node:assert/strict';
import test from 'node:test';
import { useLibraryScanSummary } from '../../src/client/composables/useLibraryScanSummary.js';

test('useLibraryScanSummary loads the shared scan summary payload', async (t) => {
  const fetchLibraryScanSummary = t.mock.fn(async () => ({
    readiness: {
      status: 'ready',
      message: 'Shared library and staging paths are ready for the first library scan.',
    },
    summary: {
      status: 'not_started',
      message: 'Library paths are ready, but no library scan has been recorded yet.',
    },
    latestRun: null,
    nextAction: null,
  }));
  const workflow = useLibraryScanSummary({ fetchLibraryScanSummary });

  assert.equal(workflow.isLoading.value, true);

  await workflow.loadLibraryScanSummary();

  assert.equal(fetchLibraryScanSummary.mock.callCount(), 1);
  assert.equal(workflow.errorMessage.value, '');
  assert.equal(workflow.readiness.value.status, 'ready');
  assert.equal(workflow.summary.value.status, 'not_started');
  assert.equal(workflow.latestRun.value, null);
});

test('useLibraryScanSummary clears stale state when the scan summary fetch fails', async () => {
  const workflow = useLibraryScanSummary({
    fetchLibraryScanSummary: async () => {
      throw new Error('library scan summary unavailable');
    },
  });

  await workflow.loadLibraryScanSummary();

  assert.equal(workflow.libraryScanSummary.value, null);
  assert.equal(workflow.errorMessage.value, 'library scan summary unavailable');
  assert.equal(workflow.summary.value, null);
  assert.equal(workflow.readiness.value, null);
});

test('useLibraryScanSummary starts a scan run and reloads the shared summary payload', async (t) => {
  const fetchLibraryScanSummary = t.mock.fn(async () => ({
    readiness: {
      status: 'ready',
      message: 'Shared library and staging paths are ready for the first library scan.',
    },
    summary: {
      status: 'pending',
      message: 'A library scan has been queued but has not started yet.',
    },
    latestRun: {
      id: 'run-1',
      status: 'pending',
    },
    nextAction: null,
  }));
  const startLibraryScanRun = t.mock.fn(async () => ({
    accepted: true,
    run: {
      id: 'run-1',
      status: 'pending',
    },
  }));
  const workflow = useLibraryScanSummary({
    fetchLibraryScanSummary,
    startLibraryScanRun,
  });

  await workflow.startLibraryScan();

  assert.equal(startLibraryScanRun.mock.callCount(), 1);
  assert.equal(fetchLibraryScanSummary.mock.callCount(), 1);
  assert.equal(workflow.actionErrorMessage.value, '');
  assert.equal(workflow.isStarting.value, false);
  assert.equal(workflow.summary.value.status, 'pending');
  assert.equal(workflow.latestRun.value.status, 'pending');
});