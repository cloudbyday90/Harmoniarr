import assert from 'node:assert/strict';
import test from 'node:test';

import {
  resolveDockerSmokeEvidenceVerificationInputs,
  verifyDockerSmokeEvidenceFromEnvironment,
} from '../../scripts/verify-docker-smoke-evidence.js';

test('resolveDockerSmokeEvidenceVerificationInputs accepts CLI overrides', () => {
  const inputs = resolveDockerSmokeEvidenceVerificationInputs({
    args: ['--evidence-path', 'supply-chain/docker-smoke.json'],
    env: {},
  });

  assert.deepEqual(inputs, {
    evidencePath: 'supply-chain/docker-smoke.json',
  });
});

test('verifyDockerSmokeEvidenceFromEnvironment validates the configured evidence artifact', async () => {
  const result = await verifyDockerSmokeEvidenceFromEnvironment({
    HARMONIARR_DOCKER_SMOKE_EVIDENCE_PATH: 'supply-chain/docker-smoke.json',
  }, {
    args: [],
    readFileFn: async (filePath, encoding) => {
      assert.equal(filePath, 'supply-chain/docker-smoke.json');
      assert.equal(encoding, 'utf8');

      return JSON.stringify({
        generatedAt: '2026-05-04T00:00:00.000Z',
        schemaVersion: 1,
        validationKind: 'released-image',
        validationResult: {
          backupRestoreFlow: {
            backupArtifactId: 'backup-1',
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
          imageRef: 'ghcr.io/cloudbyday90/harmoniarr@sha256:abc',
          projectName: 'harmoniarrsmoke-test',
          requestMusicFlow: {
            delegatedRequestId: 'request-1',
            requestedForUsername: 'smoke-listener',
            summaryScope: 'mine',
          },
        },
      });
    },
  });

  assert.deepEqual(result, {
    evidencePath: 'supply-chain/docker-smoke.json',
    generatedAt: '2026-05-04T00:00:00.000Z',
    validationKind: 'released-image',
  });
});