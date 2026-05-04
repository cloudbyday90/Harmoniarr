import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createDockerSmokeEvidence,
  dockerSmokeEvidencePathEnvVar,
  getOptionalDockerSmokeEvidencePath,
  writeDockerSmokeEvidence,
} from '../../scripts/docker-smoke-evidence.js';

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
    validationResult: {
      freshInstall: {
        healthBody: {
          service: 'ok',
        },
      },
      projectName: 'harmoniarrsmoke-test',
      workspaceRoot: '/tmp/harmoniarrsmoke-test',
    },
  });

  assert.deepEqual(evidence, {
    generatedAt: '2026-05-04T00:00:00.000Z',
    schemaVersion: 1,
    validationKind: 'fresh-install',
    validationResult: {
      freshInstall: {
        healthBody: {
          service: 'ok',
        },
      },
      projectName: 'harmoniarrsmoke-test',
    },
  });
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
      imageRef: 'ghcr.io/cloudbyday90/harmoniarr@sha256:abc',
      projectName: 'harmoniarrsmoke-test',
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
});