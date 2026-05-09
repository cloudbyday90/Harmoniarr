import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import test from 'node:test';

import {
  createDockerDeploymentManifest,
  writeDockerDeploymentManifest,
} from '../../scripts/docker-deployment-manifest.js';

function createValidationResult() {
  return {
    baselineImageRef: 'ghcr.io/cloudbyday90/harmoniarr@sha256:baseline',
    evidenceDir: resolve('artifacts/docker'),
    freshInstall: {
      evidencePath: resolve('artifacts/docker', 'harmoniarr-docker-smoke-fresh-install.json'),
      reason: null,
      status: 'passed',
      validationKind: 'fresh-install',
      validationResult: {
        projectName: 'harmoniarrsmoke-fresh',
      },
    },
    imageRef: 'ghcr.io/cloudbyday90/harmoniarr@sha256:candidate',
    releasedImage: {
      evidencePath: resolve('artifacts/docker', 'harmoniarr-docker-smoke-released-image.json'),
      reason: null,
      status: 'passed',
      validationKind: 'released-image',
      validationResult: {
        projectName: 'harmoniarrsmoke-release',
      },
    },
    browserSmoke: {
      evidencePath: resolve('artifacts/docker', 'harmoniarr-docker-browser-smoke.json'),
      reason: null,
      status: 'passed',
      validationKind: 'browser-operator-smoke',
      validationResult: {
        checkpoints: ['login_completed', 'recovery_loaded'],
      },
    },
    upgradePath: {
      evidencePath: null,
      reason: 'HARMONIARR_BASELINE_IMAGE is not configured',
      status: 'skipped',
      validationKind: null,
      validationResult: null,
    },
  };
}

test('createDockerDeploymentManifest summarizes the deployment validation result', () => {
  const manifest = createDockerDeploymentManifest({
    generatedAt: '2026-05-04T00:00:00.000Z',
    validationResult: createValidationResult(),
  });

  assert.deepEqual(manifest, {
    baselineImageRef: 'ghcr.io/cloudbyday90/harmoniarr@sha256:baseline',
    evidenceDir: resolve('artifacts/docker'),
    generatedAt: '2026-05-04T00:00:00.000Z',
    imageRef: 'ghcr.io/cloudbyday90/harmoniarr@sha256:candidate',
    schemaVersion: 1,
    validations: {
      browserSmoke: {
        evidencePath: resolve('artifacts/docker', 'harmoniarr-docker-browser-smoke.json'),
        projectName: null,
        reason: null,
        status: 'passed',
        validationKind: 'browser-operator-smoke',
      },
      freshInstall: {
        evidencePath: resolve('artifacts/docker', 'harmoniarr-docker-smoke-fresh-install.json'),
        projectName: 'harmoniarrsmoke-fresh',
        reason: null,
        status: 'passed',
        validationKind: 'fresh-install',
      },
      releasedImage: {
        evidencePath: resolve('artifacts/docker', 'harmoniarr-docker-smoke-released-image.json'),
        projectName: 'harmoniarrsmoke-release',
        reason: null,
        status: 'passed',
        validationKind: 'released-image',
      },
      upgradePath: {
        evidencePath: null,
        projectName: null,
        reason: 'HARMONIARR_BASELINE_IMAGE is not configured',
        status: 'skipped',
        validationKind: null,
      },
    },
  });
});

test('createDockerDeploymentManifest sets skipped browser summary when browser evidence is absent', () => {
  const validationResult = createValidationResult();
  delete validationResult.browserSmoke;

  const manifest = createDockerDeploymentManifest({
    generatedAt: '2026-05-04T00:00:00.000Z',
    validationResult,
  });

  assert.deepEqual(manifest.validations.browserSmoke, {
    evidencePath: null,
    projectName: null,
    reason: 'browser smoke evidence was not requested for this run',
    status: 'skipped',
    validationKind: null,
  });
});

test('writeDockerDeploymentManifest writes the manifest JSON when summaryPath is configured', async () => {
  const mkdirCalls = [];
  const writeCalls = [];

  const result = await writeDockerDeploymentManifest({
    generatedAt: '2026-05-04T00:00:00.000Z',
    mkdirFn: async (directory, options) => {
      mkdirCalls.push({ directory, options });
    },
    summaryPath: 'artifacts/docker/deployment-summary.json',
    validationResult: createValidationResult(),
    writeFileFn: async (filePath, content, encoding) => {
      writeCalls.push({ content, encoding, filePath });
    },
  });

  assert.deepEqual(mkdirCalls, [{
    directory: resolve('artifacts/docker'),
    options: { recursive: true },
  }]);
  assert.equal(writeCalls.length, 1);
  assert.equal(writeCalls[0].filePath, resolve('artifacts/docker/deployment-summary.json'));
  assert.equal(writeCalls[0].encoding, 'utf8');
  assert.match(writeCalls[0].content, /"schemaVersion": 1/);
  assert.equal(result.summaryPath, resolve('artifacts/docker/deployment-summary.json'));
});