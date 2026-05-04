import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import test from 'node:test';

import {
  createDockerDeploymentSummary,
  writeDockerDeploymentSummary,
} from '../../scripts/docker-deployment-summary.js';
import {
  resolveDockerDeploymentSummaryInputs,
  writeDockerDeploymentSummaryFromEnvironment,
} from '../../scripts/write-docker-deployment-summary.js';

function createReleasedImageEvidence() {
  return {
    generatedAt: '2026-05-04T00:00:00.000Z',
    schemaVersion: 1,
    validationKind: 'released-image',
    validationResult: {
      backupRestoreFlow: { backupArtifactId: 'backup-1', restoreApplyStatus: 'completed' },
      existingDataRestart: { healthBody: { service: 'ok' } },
      freshInstall: { healthBody: { service: 'ok' } },
      imageRef: 'ghcr.io/cloudbyday90/harmoniarr@sha256:candidate',
      projectName: 'harmoniarrsmoke-release',
      requestMusicFlow: {
        delegatedRequestId: 'request-1',
        requestedForUsername: 'smoke-listener',
        summaryScope: 'mine',
      },
    },
  };
}

function createUpgradeEvidence() {
  return {
    generatedAt: '2026-05-04T00:10:00.000Z',
    schemaVersion: 1,
    validationKind: 'upgrade',
    validationResult: {
      settingsPersistence: { observedLogLevel: 'debug' },
      upgradedRuntime: { healthBody: { service: 'ok' } },
    },
  };
}

test('resolveDockerDeploymentSummaryInputs accepts CLI overrides', () => {
  const inputs = resolveDockerDeploymentSummaryInputs({
    args: [
      '--image-ref', 'ghcr.io/cloudbyday90/harmoniarr@sha256:candidate',
      '--release-tag', 'v0.1.0-beta',
      '--released-image-evidence-path', 'supply-chain/harmoniarr-docker-smoke-released-image.json',
      '--summary-path', 'supply-chain/harmoniarr-docker-deployment-summary.json',
      '--upgrade-path-evidence-path', 'supply-chain/harmoniarr-docker-smoke-upgrade-path.json',
    ],
    env: {},
  });

  assert.deepEqual(inputs, {
    imageRef: 'ghcr.io/cloudbyday90/harmoniarr@sha256:candidate',
    releaseTag: 'v0.1.0-beta',
    releasedImageEvidencePath: 'supply-chain/harmoniarr-docker-smoke-released-image.json',
    summaryPath: 'supply-chain/harmoniarr-docker-deployment-summary.json',
    upgradePathEvidencePath: 'supply-chain/harmoniarr-docker-smoke-upgrade-path.json',
  });
});

test('createDockerDeploymentSummary summarizes released-image and optional upgrade evidence', () => {
  const summary = createDockerDeploymentSummary({
    generatedAt: '2026-05-04T01:00:00.000Z',
    imageRef: 'ghcr.io/cloudbyday90/harmoniarr@sha256:candidate',
    releaseTag: 'v0.1.0-beta',
    releasedImageEvidence: createReleasedImageEvidence(),
    releasedImageEvidencePath: resolve('supply-chain/harmoniarr-docker-smoke-released-image.json'),
    upgradePathEvidence: createUpgradeEvidence(),
    upgradePathEvidencePath: resolve('supply-chain/harmoniarr-docker-smoke-upgrade-path.json'),
  });

  assert.deepEqual(summary, {
    generatedAt: '2026-05-04T01:00:00.000Z',
    imageRef: 'ghcr.io/cloudbyday90/harmoniarr@sha256:candidate',
    releaseTag: 'v0.1.0-beta',
    schemaVersion: 1,
    summaryKind: 'release-image-workflow',
    validations: {
      releasedImage: {
        artifactName: 'harmoniarr-docker-smoke-released-image.json',
        evidenceGeneratedAt: '2026-05-04T00:00:00.000Z',
        evidencePath: resolve('supply-chain/harmoniarr-docker-smoke-released-image.json'),
        status: 'passed',
        validationKind: 'released-image',
      },
      upgradePath: {
        artifactName: 'harmoniarr-docker-smoke-upgrade-path.json',
        evidenceGeneratedAt: '2026-05-04T00:10:00.000Z',
        evidencePath: resolve('supply-chain/harmoniarr-docker-smoke-upgrade-path.json'),
        status: 'passed',
        validationKind: 'upgrade',
      },
    },
  });
});

test('writeDockerDeploymentSummary skips upgrade evidence when it is not provided', async () => {
  const writes = [];

  const result = await writeDockerDeploymentSummary({
    imageRef: 'ghcr.io/cloudbyday90/harmoniarr@sha256:candidate',
    mkdirFn: async () => {},
    releaseTag: 'v0.1.0-beta',
    releasedImageEvidencePath: 'supply-chain/harmoniarr-docker-smoke-released-image.json',
    summaryPath: 'supply-chain/harmoniarr-docker-deployment-summary.json',
    verifyDockerSmokeEvidenceFileFn: async (filePath) => {
      assert.equal(filePath, resolve('supply-chain/harmoniarr-docker-smoke-released-image.json'));
      return createReleasedImageEvidence();
    },
    writeFileFn: async (filePath, content, encoding) => {
      writes.push({ content, encoding, filePath });
    },
  });

  assert.equal(result.summaryPath, resolve('supply-chain/harmoniarr-docker-deployment-summary.json'));
  assert.equal(writes.length, 1);
  assert.equal(writes[0].encoding, 'utf8');
  assert.match(writes[0].content, /"summaryKind": "release-image-workflow"/);
  assert.match(writes[0].content, /"status": "skipped"/);
});

test('writeDockerDeploymentSummaryFromEnvironment verifies evidence paths from the environment', async () => {
  const seen = [];
  const writes = [];

  const result = await writeDockerDeploymentSummaryFromEnvironment({
    HARMONIARR_DOCKER_DEPLOYMENT_IMAGE_REF: 'ghcr.io/cloudbyday90/harmoniarr@sha256:candidate',
    HARMONIARR_DOCKER_DEPLOYMENT_RELEASE_TAG: 'v0.1.0-beta',
    HARMONIARR_DOCKER_DEPLOYMENT_RELEASED_IMAGE_EVIDENCE_PATH: 'supply-chain/harmoniarr-docker-smoke-released-image.json',
    HARMONIARR_DOCKER_DEPLOYMENT_SUMMARY_PATH: 'supply-chain/harmoniarr-docker-deployment-summary.json',
    HARMONIARR_DOCKER_DEPLOYMENT_UPGRADE_EVIDENCE_PATH: 'supply-chain/harmoniarr-docker-smoke-upgrade-path.json',
  }, {
    args: [],
    mkdirFn: async () => {},
    readFileFn: async (filePath, encoding) => {
      seen.push({ encoding, filePath });
      if (filePath.endsWith('harmoniarr-docker-smoke-released-image.json')) {
        return JSON.stringify(createReleasedImageEvidence());
      }

      return JSON.stringify(createUpgradeEvidence());
    },
    writeFileFn: async (filePath, content, encoding) => {
      writes.push({ content, encoding, filePath });
    },
  });

  assert.equal(result.summaryPath, resolve('supply-chain/harmoniarr-docker-deployment-summary.json'));
  assert.deepEqual(seen, [
    { encoding: 'utf8', filePath: resolve('supply-chain/harmoniarr-docker-smoke-released-image.json') },
    { encoding: 'utf8', filePath: resolve('supply-chain/harmoniarr-docker-smoke-upgrade-path.json') },
  ]);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].encoding, 'utf8');
});