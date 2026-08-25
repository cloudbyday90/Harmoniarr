import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertDockerSmokeValidationResultContract,
  assertDockerSmokeEvidenceContract,
  createDockerSmokeEvidence,
  dockerSmokeEvidencePathEnvVar,
  getOptionalDockerSmokeEvidencePath,
  parseDockerSmokeEvidence,
  verifyDockerSmokeEvidenceFile,
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

test('parseDockerSmokeEvidence rejects invalid JSON', () => {
  assert.throws(() => parseDockerSmokeEvidence('{not json'), /docker smoke evidence must be valid JSON/);
});

test('assertDockerSmokeEvidenceContract validates released-image evidence payloads', () => {
  const evidence = assertDockerSmokeEvidenceContract({
    generatedAt: '2026-05-04T00:00:00.000Z',
    schemaVersion: 1,
    validationKind: 'released-image',
    validationResult: {
      ...createFreshInstallValidationResult(),
      imageRef: 'ghcr.io/cloudbyday90/harmoniarr@sha256:abc',
    },
  });

  assert.equal(evidence.validationKind, 'released-image');
  assert.equal(evidence.validationResult.requestMusicFlow.delegatedRequestId, 'request-1');
});

test('assertDockerSmokeEvidenceContract validates docker provider acceptance evidence payloads', () => {
  const evidence = assertDockerSmokeEvidenceContract({
    generatedAt: '2026-06-28T00:00:00.000Z',
    schemaVersion: 1,
    validationKind: 'docker-provider-acceptance',
    validationResult: {
      baseUrl: 'http://127.0.0.1:47956',
      checkedAt: '2026-06-28T00:00:00.000Z',
      importReview: {
        currentRun: {
          id: 'execution-run-1',
          status: 'running',
        },
        diagnosticCount: 1,
        diagnostics: [{
          code: 'provider_accepted',
          title: 'Provider accepted transfer',
        }],
      },
      musicQueue: {
        linkedTransferCount: 1,
        totalTransferCount: 2,
      },
      paths: {
        downloadMappingCount: 1,
      },
      provider: {
        enabled: true,
        queueHealthStatus: 'busy',
      },
      username: 'walkthrough-admin',
    },
  });

  assert.equal(evidence.validationKind, 'docker-provider-acceptance');
  assert.equal(evidence.validationResult.importReview.diagnostics[0].code, 'provider_accepted');
});

test('assertDockerSmokeEvidenceContract rejects provider acceptance evidence without diagnostics', () => {
  assert.throws(() => assertDockerSmokeEvidenceContract({
    generatedAt: '2026-06-28T00:00:00.000Z',
    schemaVersion: 1,
    validationKind: 'docker-provider-acceptance',
    validationResult: {
      importReview: {
        diagnostics: [],
      },
      musicQueue: {
        linkedTransferCount: 0,
        totalTransferCount: 0,
      },
      paths: {},
      provider: {},
    },
  }), /docker-provider-acceptance\.importReview\.diagnostics must include at least one diagnostic/u);
});

test('verifyDockerSmokeEvidenceFile reads and validates a smoke evidence artifact', async () => {
  const evidence = await verifyDockerSmokeEvidenceFile('artifacts/docker-smoke.json', {
    readFileFn: async (filePath, encoding) => {
      assert.equal(filePath, 'artifacts/docker-smoke.json');
      assert.equal(encoding, 'utf8');
      return JSON.stringify({
        generatedAt: '2026-05-04T00:00:00.000Z',
        schemaVersion: 1,
        validationKind: 'fresh-install',
        validationResult: createFreshInstallValidationResult(),
      });
    },
  });

  assert.equal(evidence.validationKind, 'fresh-install');
  assert.equal(evidence.validationResult.requestMusicFlow.requestedForUsername, 'smoke-listener');
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
