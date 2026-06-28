import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildDownloadAcceptanceDiagnostic,
  buildNoUnlockedFilesDiagnostic,
  buildPlanningBlockedDiagnostic,
} from '../../src/server/import-candidates/import-candidate-execution-diagnostics.js';

test('download acceptance diagnostics classify full provider acceptance', () => {
  const diagnostic = buildDownloadAcceptanceDiagnostic({
    enqueueResult: {
      enqueued: [{ id: 'transfer-1' }],
      failed: [],
    },
    requestedFiles: [{ filename: 'Autechre\\Amber\\01 Foil.flac' }],
  });

  assert.deepEqual(diagnostic, {
    code: 'provider_accepted',
    counts: {
      enqueuedTransfers: 1,
      failedFiles: 0,
      requestedFiles: 1,
    },
    enqueuedTransferIds: ['transfer-1'],
    message: 'The download provider accepted 1 transfer for this candidate.',
    operatorAction: 'Monitor Downloader until the transfer completes, then continue import review.',
    title: 'Provider accepted transfer',
    tone: 'success',
    warningMessage: null,
  });
});

test('download acceptance diagnostics classify partial provider rejection', () => {
  const diagnostic = buildDownloadAcceptanceDiagnostic({
    enqueueResult: {
      enqueued: [{ id: 'transfer-1' }],
      failed: ['Autechre\\Amber\\02 Montreal.flac'],
    },
    requestedFiles: [
      { filename: 'Autechre\\Amber\\01 Foil.flac' },
      { filename: 'Autechre\\Amber\\02 Montreal.flac' },
    ],
  });

  assert.equal(diagnostic.code, 'provider_accepted_with_rejections');
  assert.equal(diagnostic.tone, 'warning');
  assert.deepEqual(diagnostic.counts, {
    enqueuedTransfers: 1,
    failedFiles: 1,
    requestedFiles: 2,
  });
  assert.deepEqual(diagnostic.failedFilenames, ['Autechre\\Amber\\02 Montreal.flac']);
});

test('download acceptance diagnostics classify all-file provider rejection', () => {
  const diagnostic = buildDownloadAcceptanceDiagnostic({
    enqueueResult: {
      enqueued: [],
      failed: ['Autechre\\Amber\\01 Foil.flac'],
    },
    requestedFiles: [{ filename: 'Autechre\\Amber\\01 Foil.flac' }],
  });

  assert.equal(diagnostic.code, 'provider_rejected_all_files');
  assert.equal(diagnostic.tone, 'danger');
  assert.equal(diagnostic.title, 'Provider rejected the candidate');
  assert.equal(
    diagnostic.operatorAction,
    'Try another candidate or rerun discovery; the remote peer may no longer offer acceptable files.',
  );
});

test('download acceptance diagnostics classify pre-provider blockers', () => {
  assert.deepEqual(buildNoUnlockedFilesDiagnostic({
    candidate: {
      fileCount: 2,
      lockedFileCount: 2,
    },
  }), {
    code: 'no_unlocked_files',
    counts: {
      lockedFiles: 2,
      requestedFiles: 0,
      totalFiles: 2,
    },
    message: 'No unlocked files are available to enqueue from this candidate.',
    operatorAction: 'Open the candidate, review locked or filtered files, then select a candidate with downloadable files.',
    title: 'No downloadable files',
    tone: 'warning',
  });

  assert.equal(buildPlanningBlockedDiagnostic({
    candidate: { fileCount: 1 },
    message: 'Explicit path mapping is still required.',
  }).operatorAction, 'Review the candidate planning details, especially path mappings and validation blockers.');
});
