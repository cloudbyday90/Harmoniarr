import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertDockerSmokeValidationResultContract,
  createDockerSmokeEvidence,
  dockerSmokeEvidencePathEnvVar,
  getOptionalDockerSmokeEvidencePath,
  writeDockerSmokeEvidence,
} from '../../scripts/docker-smoke-evidence.js';

function createFreshInstallValidationResult() {
  return {
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
    projectName: 'harmoniarrsmoke-test',
    requestMusicFlow: {
      delegatedRequestId: 'request-1',
      requestedForUsername: 'smoke-listener',
      summaryScope: 'mine',
    },
    workspaceRoot: '/tmp/harmoniarrsmoke-test',
  };
}

test('getOptionalDockerSmokeEvidencePath reads the configured environment path', () => {
  assert.equal(
    getOptionalDockerSmokeEvidencePath({
      [dockerSmokeEvidencePathEnvVar]: '  ./artifacts/docker-smoke.json  ',
    }),
    './artifacts/docker-smoke.json',
  );
  assert.equal(getOptionalDockerSmokeEvidencePath({}), null);
});

test('createDockerSmokeEvidence omits workspaceRoot from the machine-readable payload', () => {
  const evidence = createDockerSmokeEvidence({
    generatedAt: '2026-05-04T00:00:00.000Z',
    validationKind: 'fresh-install',
    validationResult: createFreshInstallValidationResult(),
  });

  assert.deepEqual(evidence, {
    generatedAt: '2026-05-04T00:00:00.000Z',
    schemaVersion: 1,
    validationKind: 'fresh-install',
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
      projectName: 'harmoniarrsmoke-test',
      requestMusicFlow: {
        delegatedRequestId: 'request-1',
        requestedForUsername: 'smoke-listener',
        summaryScope: 'mine',
      },
    },
  });
});

test('assertDockerSmokeValidationResultContract rejects fresh-install evidence without delegated request music proof', () => {
  assert.throws(() => assertDockerSmokeValidationResultContract({
    validationKind: 'fresh-install',
    validationResult: {
      backupRestoreFlow: {
        backupArtifactId: 'backup-1',
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
    },
  }), /fresh-install\.requestMusicFlow must be an object/);
});

test('writeDockerSmokeEvidence writes a JSON file when configured', async () => {
  const writes = [];
  const mkdirCalls = [];

  const result = await writeDockerSmokeEvidence({
    evidencePath: 'artifacts/docker-smoke.json',
    generatedAt: '2026-05-04T00:00:00.000Z',
    mkdirFn: async (directory, options) => {
      mkdirCalls.push({ directory, options });
    },
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
    writeFileFn: async (filePath, content, encoding) => {
      writes.push({ content, encoding, filePath });
    },
  });

  assert.equal(result.evidencePath.endsWith('artifacts\\docker-smoke.json') || result.evidencePath.endsWith('artifacts/docker-smoke.json'), true);
  assert.deepEqual(mkdirCalls, [
    {
      directory: result.evidencePath.replace(/[\\/][^\\/]+$/, ''),
      options: { recursive: true },
    },
  ]);
  assert.equal(writes[0].encoding, 'utf8');
  assert.equal(writes[0].filePath, result.evidencePath);
  assert.match(writes[0].content, /"validationKind": "released-image"/);
  assert.match(writes[0].content, /"imageRef": "ghcr.io\/cloudbyday90\/harmoniarr@sha256:abc"/);
  assert.match(writes[0].content, /"requestMusicFlow": \{/);
  assert.match(writes[0].content, /"delegatedRequestId": "request-1"/);
});