import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import test from 'node:test';

import {
  dockerDeploymentPathEvidenceFileNames,
  runDockerDeploymentPathValidation,
} from '../../scripts/docker-deployment-validation.js';
import { dockerDeploymentSummaryPathEnvVar } from '../../scripts/docker-deployment-manifest.js';
import { resolveDockerDeploymentPathValidationInputs } from '../../scripts/validate-docker-deployment-path.js';

function createFreshInstallValidationResult(projectName) {
  return {
    backupRestoreFlow: {
      backupArtifactId: `${projectName}-backup`,
      restoreApplyStatus: 'completed',
    },
    existingDataRestart: {
      healthBody: {
        service: 'ok',
      },
    },
    freshInstall: {
      healthBody: {
        service: 'ok',
      },
    },
    imageRef: null,
    port: 3000,
    projectName,
    requestMusicFlow: {
      delegatedRequestId: `${projectName}-request`,
      requestedForUsername: 'smoke-listener',
      summaryScope: 'mine',
    },
  };
}

test('resolveDockerDeploymentPathValidationInputs accepts CLI overrides', () => {
  const inputs = resolveDockerDeploymentPathValidationInputs({
    args: [
      '--image-ref', 'ghcr.io/cloudbyday90/harmoniarr@sha256:candidate',
      '--baseline-image-ref', 'ghcr.io/cloudbyday90/harmoniarr@sha256:baseline',
      '--evidence-dir', 'artifacts/docker',
      '--summary-path', 'artifacts/docker/deployment-summary.json',
    ],
    env: {},
  });

  assert.deepEqual(inputs, {
    baselineImageRef: 'ghcr.io/cloudbyday90/harmoniarr@sha256:baseline',
    evidenceDir: 'artifacts/docker',
    imageRef: 'ghcr.io/cloudbyday90/harmoniarr@sha256:candidate',
    summaryPath: 'artifacts/docker/deployment-summary.json',
  });
});

test('resolveDockerDeploymentPathValidationInputs accepts summary-path from the environment', () => {
  const inputs = resolveDockerDeploymentPathValidationInputs({
    args: [],
    env: {
      [dockerDeploymentSummaryPathEnvVar]: 'artifacts/docker/deployment-summary.json',
    },
  });

  assert.deepEqual(inputs, {
    baselineImageRef: null,
    evidenceDir: null,
    imageRef: null,
    summaryPath: 'artifacts/docker/deployment-summary.json',
  });
});

test('runDockerDeploymentPathValidation always runs fresh-install and skips optional immutable-image validations when refs are absent', async () => {
  const freshInstallCalls = [];
  const upgradeCalls = [];
  const evidenceCalls = [];
  const summaryCalls = [];

  const result = await runDockerDeploymentPathValidation({
    validateDockerFreshInstallFn: async (options) => {
      freshInstallCalls.push(options);
      return createFreshInstallValidationResult('fresh-install');
    },
    validateDockerUpgradePathFn: async (options) => {
      upgradeCalls.push(options);
      return {
        baselineImageRef: 'unused',
        settingsPersistence: {
          observedLogLevel: 'info',
        },
        upgradedRuntime: {
          healthBody: {
            service: 'ok',
          },
        },
      };
    },
    writeDockerSmokeEvidenceFn: async (options) => {
      evidenceCalls.push(options);
      return null;
    },
    writeDockerDeploymentManifestFn: async (options) => {
      summaryCalls.push(options);
      return null;
    },
  });

  assert.deepEqual(freshInstallCalls, [{
    verifyBackupRestoreFlow: true,
    verifyExistingDataRestart: true,
    verifyRequestMusicFlow: true,
  }]);
  assert.deepEqual(upgradeCalls, []);
  assert.deepEqual(evidenceCalls, [{
    evidencePath: null,
    validationKind: 'fresh-install',
    validationResult: createFreshInstallValidationResult('fresh-install'),
  }]);
  assert.deepEqual(summaryCalls, [{
    summaryPath: null,
    validationResult: {
      baselineImageRef: null,
      evidenceDir: null,
      freshInstall: {
        evidencePath: null,
        reason: null,
        status: 'passed',
        validationKind: 'fresh-install',
        validationResult: createFreshInstallValidationResult('fresh-install'),
      },
      imageRef: null,
      releasedImage: {
        evidencePath: null,
        reason: 'HARMONIARR_IMAGE is not configured',
        status: 'skipped',
        validationKind: null,
        validationResult: null,
      },
      upgradePath: {
        evidencePath: null,
        reason: 'HARMONIARR_BASELINE_IMAGE is not configured',
        status: 'skipped',
        validationKind: null,
        validationResult: null,
      },
    },
  }]);
  assert.equal(result.freshInstall.status, 'passed');
  assert.equal(result.releasedImage.status, 'skipped');
  assert.equal(result.releasedImage.reason, 'HARMONIARR_IMAGE is not configured');
  assert.equal(result.summaryPath, null);
  assert.equal(result.upgradePath.status, 'skipped');
  assert.equal(result.upgradePath.reason, 'HARMONIARR_BASELINE_IMAGE is not configured');
});

test('runDockerDeploymentPathValidation reuses immutable image refs and writes stable evidence filenames when configured', async () => {
  const freshInstallCalls = [];
  const upgradeCalls = [];
  const evidenceCalls = [];
  const summaryCalls = [];

  const result = await runDockerDeploymentPathValidation({
    baselineImageRef: 'ghcr.io/cloudbyday90/harmoniarr@sha256:baseline',
    evidenceDir: 'artifacts/docker',
    imageRef: 'ghcr.io/cloudbyday90/harmoniarr@sha256:candidate',
    summaryPath: 'artifacts/docker/deployment-summary.json',
    validateDockerFreshInstallFn: async (options) => {
      freshInstallCalls.push(options);
      return createFreshInstallValidationResult(`run-${freshInstallCalls.length}`);
    },
    validateDockerUpgradePathFn: async (options) => {
      upgradeCalls.push(options);
      return {
        baselineImageRef: options.baselineImageRef,
        candidateImageRef: options.candidateImageRef,
        settingsPersistence: {
          observedLogLevel: 'debug',
        },
        upgradedRuntime: {
          healthBody: {
            service: 'ok',
          },
        },
      };
    },
    writeDockerSmokeEvidenceFn: async (options) => {
      evidenceCalls.push(options);
      return {
        evidencePath: options.evidencePath,
      };
    },
    writeDockerDeploymentManifestFn: async (options) => {
      summaryCalls.push(options);
      return {
        summaryPath: options.summaryPath,
      };
    },
  });

  assert.deepEqual(freshInstallCalls, [
    {
      verifyBackupRestoreFlow: true,
      verifyExistingDataRestart: true,
      verifyRequestMusicFlow: true,
    },
    {
      buildImage: false,
      imageRef: 'ghcr.io/cloudbyday90/harmoniarr@sha256:candidate',
      verifyBackupRestoreFlow: true,
      verifyExistingDataRestart: true,
      verifyRequestMusicFlow: true,
    },
  ]);
  assert.deepEqual(upgradeCalls, [{
    baselineImageRef: 'ghcr.io/cloudbyday90/harmoniarr@sha256:baseline',
    buildCandidateImage: false,
    candidateImageRef: 'ghcr.io/cloudbyday90/harmoniarr@sha256:candidate',
  }]);
  assert.deepEqual(evidenceCalls.map((call) => ({
    evidencePath: call.evidencePath,
    validationKind: call.validationKind,
  })), [
    {
      evidencePath: resolve('artifacts/docker', dockerDeploymentPathEvidenceFileNames.freshInstall),
      validationKind: 'fresh-install',
    },
    {
      evidencePath: resolve('artifacts/docker', dockerDeploymentPathEvidenceFileNames.releasedImage),
      validationKind: 'released-image',
    },
    {
      evidencePath: resolve('artifacts/docker', dockerDeploymentPathEvidenceFileNames.upgradePath),
      validationKind: 'upgrade-path',
    },
  ]);
  assert.equal(summaryCalls.length, 1);
  assert.equal(summaryCalls[0].summaryPath, 'artifacts/docker/deployment-summary.json');
  assert.equal(summaryCalls[0].validationResult.freshInstall.status, 'passed');
  assert.equal(summaryCalls[0].validationResult.releasedImage.status, 'passed');
  assert.equal(summaryCalls[0].validationResult.upgradePath.status, 'passed');
  assert.equal(result.evidenceDir, resolve('artifacts/docker'));
  assert.equal(result.releasedImage.status, 'passed');
  assert.equal(result.summaryPath, 'artifacts/docker/deployment-summary.json');
  assert.equal(result.upgradePath.status, 'passed');
});