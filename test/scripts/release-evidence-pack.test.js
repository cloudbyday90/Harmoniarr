import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import test from 'node:test';

import {
  createReleaseEvidenceRunId,
  releaseEvidenceDirEnvVar,
  releaseEvidenceRunIdEnvVar,
  resolveReleaseEvidencePackInputs,
  runReleaseEvidencePackValidation,
} from '../../scripts/release-evidence-pack.js';

test('createReleaseEvidenceRunId returns UTC timestamp-based run id', () => {
  assert.equal(
    createReleaseEvidenceRunId(new Date('2026-05-09T14:30:45.000Z')),
    '20260509-143045',
  );
});

test('resolveReleaseEvidencePackInputs derives default evidence directory and summary path', () => {
  const inputs = resolveReleaseEvidencePackInputs({
    args: [],
    env: {},
    nowFn: () => new Date('2026-05-09T14:30:45.000Z'),
  });

  assert.deepEqual(inputs, {
    baselineImageRef: null,
    evidenceDir: resolve('artifacts/release-evidence', '20260509-143045'),
    imageRef: null,
    runId: '20260509-143045',
    summaryPath: resolve('artifacts/release-evidence', '20260509-143045', 'harmoniarr-docker-deployment-summary.json'),
  });
});

test('resolveReleaseEvidencePackInputs accepts CLI and environment overrides', () => {
  const inputs = resolveReleaseEvidencePackInputs({
    args: [
      '--image-ref', 'ghcr.io/cloudbyday90/harmoniarr@sha256:candidate',
      '--baseline-image-ref', 'ghcr.io/cloudbyday90/harmoniarr@sha256:baseline',
      '--evidence-dir', 'artifacts/custom',
      '--summary-path', 'artifacts/custom/summary.json',
      '--run-id', 'manual-run-id',
    ],
    env: {
      [releaseEvidenceDirEnvVar]: 'ignored-by-cli',
      [releaseEvidenceRunIdEnvVar]: 'ignored-run-id',
    },
  });

  assert.deepEqual(inputs, {
    baselineImageRef: 'ghcr.io/cloudbyday90/harmoniarr@sha256:baseline',
    evidenceDir: 'artifacts/custom',
    imageRef: 'ghcr.io/cloudbyday90/harmoniarr@sha256:candidate',
    runId: 'manual-run-id',
    summaryPath: 'artifacts/custom/summary.json',
  });
});

test('runReleaseEvidencePackValidation delegates to deployment-path validation with resolved inputs', async () => {
  const calls = [];

  const result = await runReleaseEvidencePackValidation({
    baselineImageRef: 'ghcr.io/cloudbyday90/harmoniarr@sha256:baseline',
    evidenceDir: 'artifacts/release-evidence/20260509-143045',
    imageRef: 'ghcr.io/cloudbyday90/harmoniarr@sha256:candidate',
    runDockerDeploymentPathValidationFn: async (options) => {
      calls.push(options);
      return {
        evidenceDir: resolve(options.evidenceDir),
        freshInstall: { status: 'passed' },
        releasedImage: { status: 'passed' },
        summaryPath: options.summaryPath,
        upgradePath: { status: 'passed' },
      };
    },
    runId: '20260509-143045',
    summaryPath: 'artifacts/release-evidence/20260509-143045/harmoniarr-docker-deployment-summary.json',
  });

  assert.deepEqual(calls, [{
    baselineImageRef: 'ghcr.io/cloudbyday90/harmoniarr@sha256:baseline',
    evidenceDir: 'artifacts/release-evidence/20260509-143045',
    imageRef: 'ghcr.io/cloudbyday90/harmoniarr@sha256:candidate',
    summaryPath: 'artifacts/release-evidence/20260509-143045/harmoniarr-docker-deployment-summary.json',
  }]);
  assert.equal(result.runId, '20260509-143045');
  assert.equal(result.freshInstall.status, 'passed');
  assert.equal(result.releasedImage.status, 'passed');
  assert.equal(result.upgradePath.status, 'passed');
});
