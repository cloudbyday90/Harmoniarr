/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyPublishedImageProvenance } from '../../scripts/published-image-provenance.js';
import { publishedImagePredicateType } from '../../scripts/published-image-provenance-policy.js';

const inputs = Object.freeze({ imageRef: `ghcr.io/cloudbyday90/harmoniarr@sha256:${'a'.repeat(64)}`,
  revision: 'b'.repeat(40), repository: 'cloudbyday90/Harmoniarr' });
const verifiedAt = '2026-09-12T15:00:00.000Z';

function verificationOutput() {
  return [{ verificationResult: { signature: { certificate: { unusedField: 'PRIVATE_CERTIFICATE_FIXTURE' } },
    statement: { predicateType: publishedImagePredicateType, predicate: { privateField: 'PRIVATE_PREDICATE_FIXTURE' },
      subject: [{ name: 'ghcr.io/cloudbyday90/harmoniarr', digest: { sha256: 'a'.repeat(64) } }] } } }];
}

test('single-image provenance pins the live GitHub verifier and returns only a safe identity proof', async () => {
  const env = { GH_TOKEN: 'PRIVATE_TOKEN_FIXTURE' };
  let calls = 0;
  const result = await verifyPublishedImageProvenance(inputs, { env, getNow: () => new Date(verifiedAt),
    runTrustCommandFn: async (options) => {
      calls += 1;
      assert.equal(options.command, 'gh');
      assert.equal(options.env, env);
      assert.equal(options.timeoutMs, 90_000);
      assert.deepEqual(options.args, ['attestation', 'verify', `oci://${inputs.imageRef}`,
        '--hostname', 'github.com', '--repo', inputs.repository,
        '--signer-workflow', `${inputs.repository}/.github/workflows/release-image.yml`,
        '--source-digest', inputs.revision, '--signer-digest', inputs.revision,
        '--deny-self-hosted-runners', '--predicate-type', publishedImagePredicateType,
        '--limit', '10', '--format', 'json']);
      return { exitCode: 0, stdout: JSON.stringify(verificationOutput()), stderr: 'PRIVATE_STDERR_FIXTURE' };
    },
  });

  assert.equal(calls, 1);
  assert.deepEqual(result, { schemaVersion: 1, verificationKind: 'published-image-provenance', status: 'passed',
    provenanceVerified: true, reference: inputs.imageRef, revision: inputs.revision, repository: inputs.repository,
    signerWorkflow: `${inputs.repository}/.github/workflows/release-image.yml`, predicateType: publishedImagePredicateType,
    attestationCount: 1, verifiedAt });
  assert.equal(JSON.stringify(result).includes('PRIVATE_'), false);
});

for (const [label, overrides] of [
  ['mutable tag', { imageRef: 'ghcr.io/cloudbyday90/harmoniarr:latest' }],
  ['local image', { imageRef: `sha256:${'a'.repeat(64)}` }],
  ['different image namespace', { imageRef: inputs.imageRef.replace('cloudbyday90', 'other') }],
  ['missing source SHA', { revision: undefined }],
  ['abbreviated source SHA', { revision: 'abcdef0' }],
  ['malformed repository', { repository: 'other/repo/workflow' }],
]) {
  test(`single-image provenance rejects ${label} before any external command`, async () => {
    await assert.rejects(verifyPublishedImageProvenance({ ...inputs, ...overrides }, {
      runTrustCommandFn: async () => { assert.fail('Unexpected command'); },
    }), { code: 'published_image_provenance_failed' });
  });
}

for (const [label, output] of [
  ['failed native verification with forged JSON', { exitCode: 1, stdout: JSON.stringify(verificationOutput()) }],
  ['unverified caller claim', { exitCode: 0, stdout: '[{"verified":true}]' }],
  ['malformed JSON', { exitCode: 0, stdout: 'PRIVATE_INVALID_FIXTURE' }],
  ['empty verification', { exitCode: 0, stdout: '[]' }],
  ['too many attestations', { exitCode: 0, stdout: JSON.stringify(Array(11).fill(verificationOutput()[0])) }],
  ['oversized output', { exitCode: 0, stdout: 'x'.repeat(1_048_577) }],
]) {
  test(`single-image provenance rejects ${label} with a safe error`, async () => {
    await assert.rejects(verifyPublishedImageProvenance(inputs, { runTrustCommandFn: async () => output }),
      (error) => error.code === 'published_image_provenance_failed' && !error.message.includes('PRIVATE_'));
  });
}

test('single-image provenance keeps native verifier failures private', async () => {
  await assert.rejects(verifyPublishedImageProvenance(inputs, { runTrustCommandFn: async () => {
    throw new Error('PRIVATE_TOKEN_FIXTURE in a failed registry request');
  } }), (error) => error.code === 'published_image_provenance_failed' && !error.message.includes('PRIVATE_'));
});
