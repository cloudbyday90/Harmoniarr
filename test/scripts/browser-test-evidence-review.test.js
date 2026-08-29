/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertBrowserTestEvidenceReviewInputContract,
  browserTestEvidenceReviewRequiredSampleCount,
  createBrowserTestEvidenceReview,
  parseBrowserTestEvidenceReviewInput,
  renderBrowserTestEvidenceReviewSummary,
  writeBrowserTestEvidenceReview,
} from '../../scripts/browser-test-evidence-review.js';

function createEvidence({
  cleanupStatus = 'clean',
  durationMs = 300_000,
  status = 'passed',
  workerCount = 2,
} = {}) {
  const cleanup = {
    attempts: 1,
    maxWaitMs: 25_000,
    status: cleanupStatus,
  };

  if (cleanupStatus !== 'check_failed') {
    cleanup.browserTestProcessCount = 0;
    cleanup.testcontainerCount = 0;
  }

  return {
    browserTest: {
      durationMs,
      status,
      workerCount,
    },
    cleanup,
    generatedAt: '2026-08-29T12:00:00.000Z',
    schemaVersion: 1,
  };
}

function createSamples(count = browserTestEvidenceReviewRequiredSampleCount) {
  return Array.from({ length: count }, (_, index) => ({
    evidence: createEvidence({ durationMs: (index + 1) * 100_000 }),
    runId: 80_000 + index,
  }));
}

test('browser evidence review confirms exactly ten clean two-worker browser runs', () => {
  const review = createBrowserTestEvidenceReview({
    generatedAt: '2026-08-29T13:00:00.000Z',
    samples: createSamples(),
  });
  const summary = renderBrowserTestEvidenceReviewSummary(review);

  assert.equal(review.status, 'baseline_confirmed');
  assert.equal(review.sampleCount, 10);
  assert.deepEqual(review.findings, []);
  assert.deepEqual(review.durationMs, {
    maximum: 1_000_000,
    median: 550_000,
    minimum: 100_000,
    p95: 1_000_000,
  });
  assert.match(summary, /Result: \*\*Baseline Confirmed\*\*/u);
  assert.match(summary, /Samples: \*\*10\/10\*\*/u);
  assert.match(summary, /Duration \(descriptive\):/u);
});

test('browser evidence review keeps an incomplete sample distinct from a failed review', () => {
  const incomplete = createBrowserTestEvidenceReview({ samples: createSamples(2) });
  const reviewRequired = createBrowserTestEvidenceReview({
    samples: createSamples().map((sample, index) => index === 4
      ? { ...sample, evidence: createEvidence({ status: 'failed' }) }
      : sample),
  });

  assert.equal(incomplete.status, 'incomplete');
  assert.deepEqual(incomplete.findings, [{
    code: 'sample_count_shortfall',
    receivedSampleCount: 2,
    requiredSampleCount: 10,
  }]);
  assert.equal(reviewRequired.status, 'review_required');
  assert.deepEqual(reviewRequired.findings, [{
    code: 'browser_test_failed',
    runIds: [80_004],
  }]);
});

test('browser evidence review reports cleanup and worker-count drift without retaining raw runtime details', () => {
  const samples = createSamples();
  samples[2] = {
    ...samples[2],
    evidence: createEvidence({ cleanupStatus: 'resources_remaining' }),
  };
  samples[7] = {
    ...samples[7],
    evidence: createEvidence({ workerCount: 1 }),
  };

  const review = createBrowserTestEvidenceReview({ samples });
  const summary = renderBrowserTestEvidenceReviewSummary(review);

  assert.equal(review.status, 'review_required');
  assert.deepEqual(review.findings, [
    { code: 'cleanup_not_clean', runIds: [80_002] },
    { code: 'worker_count_changed', runIds: [80_007] },
  ]);
  assert.match(summary, /Cleanup was not clean for run IDs: 80002\./u);
  assert.doesNotMatch(JSON.stringify(review), /container id|command line|workspaceRoot/iu);
});

test('browser evidence review rejects malformed, duplicate, and untrusted manifest input', () => {
  const samples = createSamples(2);
  samples[1] = { ...samples[1], runId: samples[0].runId };

  assert.throws(
    () => assertBrowserTestEvidenceReviewInputContract({
      samples: createSamples(),
      schemaVersion: 1,
      userName: 'not-allowed',
    }),
    /userName is not allowed/u,
  );
  assert.throws(
    () => createBrowserTestEvidenceReview({ samples }),
    /runId must be unique/u,
  );
  assert.throws(
    () => parseBrowserTestEvidenceReviewInput('{not-json'),
    /must be valid JSON/u,
  );
});

test('browser evidence review reads and writes only distinct paths below the workspace', async () => {
  const writes = [];
  const result = await writeBrowserTestEvidenceReview({
    cwd: process.cwd(),
    inputPath: 'artifacts/evidence-manifest.json',
    mkdirFn: async () => {},
    outputPath: 'artifacts/evidence-review.json',
    readFileFn: async (filePath) => {
      assert.equal(filePath.includes('artifacts'), true);
      return JSON.stringify({ samples: createSamples(), schemaVersion: 1 });
    },
    writeFileFn: async (filePath, content, encoding) => {
      writes.push({ content, encoding, filePath });
    },
  });

  assert.equal(result.review.status, 'baseline_confirmed');
  assert.equal(writes[0].encoding, 'utf8');
  assert.match(writes[0].content, /"status": "baseline_confirmed"/u);
  await assert.rejects(
    () => writeBrowserTestEvidenceReview({
      cwd: process.cwd(),
      inputPath: 'artifacts/evidence.json',
      outputPath: 'artifacts/evidence.json',
    }),
    /input and output paths must differ/u,
  );
});
