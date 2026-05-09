import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import test from 'node:test';

import {
  createReleaseEvidenceRunId,
  releaseEvidenceIncludeBrowserSmokeEnvVar,
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
    browserBaseUrl: 'http://127.0.0.1:47956',
    browserEvidencePath: resolve('artifacts/release-evidence', '20260509-143045', 'harmoniarr-docker-browser-smoke.json'),
    browserHeadless: true,
    browserPassword: null,
    browserTimeoutMs: 15000,
    browserUsername: null,
    evidenceDir: resolve('artifacts/release-evidence', '20260509-143045'),
    imageRef: null,
    includeBrowserSmoke: false,
    runId: '20260509-143045',
    summaryPath: resolve('artifacts/release-evidence', '20260509-143045', 'harmoniarr-docker-deployment-summary.json'),
  });
});

test('resolveReleaseEvidencePackInputs accepts CLI and environment overrides', () => {
  const inputs = resolveReleaseEvidencePackInputs({
    args: [
      '--image-ref', 'ghcr.io/cloudbyday90/harmoniarr@sha256:candidate',
      '--baseline-image-ref', 'ghcr.io/cloudbyday90/harmoniarr@sha256:baseline',
      '--browser-base-url', 'http://127.0.0.1:49100',
      '--browser-evidence-path', 'artifacts/custom/browser-smoke.json',
      '--browser-headless',
      '--browser-password', 'BrowserPass123!',
      '--browser-timeout-ms', '25000',
      '--browser-username', 'walkthrough-admin',
      '--evidence-dir', 'artifacts/custom',
      '--include-browser-smoke',
      '--summary-path', 'artifacts/custom/summary.json',
      '--run-id', 'manual-run-id',
    ],
    env: {
      [releaseEvidenceDirEnvVar]: 'ignored-by-cli',
      [releaseEvidenceIncludeBrowserSmokeEnvVar]: 'false',
      [releaseEvidenceRunIdEnvVar]: 'ignored-run-id',
    },
  });

  assert.deepEqual(inputs, {
    baselineImageRef: 'ghcr.io/cloudbyday90/harmoniarr@sha256:baseline',
    browserBaseUrl: 'http://127.0.0.1:49100',
    browserEvidencePath: 'artifacts/custom/browser-smoke.json',
    browserHeadless: true,
    browserPassword: 'BrowserPass123!',
    browserTimeoutMs: 25000,
    browserUsername: 'walkthrough-admin',
    evidenceDir: 'artifacts/custom',
    imageRef: 'ghcr.io/cloudbyday90/harmoniarr@sha256:candidate',
    includeBrowserSmoke: true,
    runId: 'manual-run-id',
    summaryPath: 'artifacts/custom/summary.json',
  });
});

test('runReleaseEvidencePackValidation records a skipped browser smoke summary when not enabled', async () => {
  const deploymentCalls = [];
  const summaryCalls = [];

  const result = await runReleaseEvidencePackValidation({
    baselineImageRef: 'ghcr.io/cloudbyday90/harmoniarr@sha256:baseline',
    evidenceDir: 'artifacts/release-evidence/20260509-143045',
    imageRef: 'ghcr.io/cloudbyday90/harmoniarr@sha256:candidate',
    runDockerDeploymentPathValidationFn: async (options) => {
      deploymentCalls.push(options);
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
    writeDockerDeploymentManifestFn: async (options) => {
      summaryCalls.push(options);
      return {
        summaryPath: resolve(options.summaryPath),
      };
    },
  });

  assert.deepEqual(deploymentCalls, [{
    baselineImageRef: 'ghcr.io/cloudbyday90/harmoniarr@sha256:baseline',
    evidenceDir: 'artifacts/release-evidence/20260509-143045',
    imageRef: 'ghcr.io/cloudbyday90/harmoniarr@sha256:candidate',
    summaryPath: 'artifacts/release-evidence/20260509-143045/harmoniarr-docker-deployment-summary.json',
  }]);
  assert.equal(summaryCalls.length, 1);
  assert.equal(summaryCalls[0].validationResult.browserSmoke.status, 'skipped');
  assert.match(summaryCalls[0].validationResult.browserSmoke.reason, /not enabled/i);
  assert.equal(result.runId, '20260509-143045');
  assert.equal(result.browserSmoke.status, 'skipped');
  assert.equal(result.freshInstall.status, 'passed');
  assert.equal(result.releasedImage.status, 'passed');
  assert.equal(result.summaryPath, resolve('artifacts/release-evidence/20260509-143045/harmoniarr-docker-deployment-summary.json'));
  assert.equal(result.upgradePath.status, 'passed');
});

test('runReleaseEvidencePackValidation executes browser smoke when enabled and includes it in summary payload', async () => {
  const browserCalls = [];
  const summaryCalls = [];

  const result = await runReleaseEvidencePackValidation({
    baselineImageRef: null,
    browserBaseUrl: 'http://127.0.0.1:47956',
    browserEvidencePath: 'artifacts/release-evidence/20260509-143045/harmoniarr-docker-browser-smoke.json',
    browserHeadless: true,
    browserPassword: 'HarmoniarrLocal123!',
    browserTimeoutMs: 15000,
    browserUsername: 'walkthrough-admin',
    evidenceDir: 'artifacts/release-evidence/20260509-143045',
    includeBrowserSmoke: true,
    runDockerDeploymentPathValidationFn: async (options) => ({
      evidenceDir: resolve(options.evidenceDir),
      freshInstall: { status: 'passed' },
      releasedImage: { status: 'skipped', reason: 'HARMONIARR_IMAGE is not configured' },
      summaryPath: options.summaryPath,
      upgradePath: { status: 'skipped', reason: 'HARMONIARR_BASELINE_IMAGE is not configured' },
    }),
    runDockerOperatorBrowserSmokeFn: async (options) => {
      browserCalls.push(options);
      return {
        baseUrl: options.baseUrl,
        checkpoints: ['login_completed', 'recovery_loaded'],
        evidencePath: resolve(options.evidencePath),
        username: options.username,
      };
    },
    summaryPath: 'artifacts/release-evidence/20260509-143045/harmoniarr-docker-deployment-summary.json',
    writeDockerDeploymentManifestFn: async (options) => {
      summaryCalls.push(options);
      return {
        summaryPath: resolve(options.summaryPath),
      };
    },
  });

  assert.deepEqual(browserCalls, [{
    baseUrl: 'http://127.0.0.1:47956',
    evidencePath: 'artifacts/release-evidence/20260509-143045/harmoniarr-docker-browser-smoke.json',
    headless: true,
    password: 'HarmoniarrLocal123!',
    timeoutMs: 15000,
    username: 'walkthrough-admin',
  }]);
  assert.equal(summaryCalls.length, 1);
  assert.equal(summaryCalls[0].validationResult.browserSmoke.status, 'passed');
  assert.equal(summaryCalls[0].validationResult.browserSmoke.validationKind, 'browser-operator-smoke');
  assert.deepEqual(summaryCalls[0].validationResult.browserSmoke.validationResult.checkpoints, ['login_completed', 'recovery_loaded']);
  assert.equal(result.browserSmoke.status, 'passed');
  assert.equal(result.browserSmoke.validationKind, 'browser-operator-smoke');
  assert.equal(result.browserSmoke.validationResult.username, 'walkthrough-admin');
});
