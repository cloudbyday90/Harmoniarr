/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { publishedImagePredicateType } from '../../scripts/published-image-provenance-policy.js';
import { parsePublishedImageProvenanceInputs, runPublishedImageProvenanceCommand } from '../../scripts/verify-published-image-provenance.js';

const baseEnv = Object.freeze({
  HARMONIARR_IMAGE: `ghcr.io/cloudbyday90/harmoniarr@sha256:${'a'.repeat(64)}`,
  HARMONIARR_IMAGE_REVISION: 'b'.repeat(40), HARMONIARR_REPOSITORY: 'cloudbyday90/Harmoniarr',
  HARMONIARR_PROVENANCE_EVIDENCE_PATH: 'unused.json',
});

function passedProof() {
  return { schemaVersion: 1, verificationKind: 'published-image-provenance', status: 'passed', provenanceVerified: true,
    reference: baseEnv.HARMONIARR_IMAGE, revision: baseEnv.HARMONIARR_IMAGE_REVISION,
    repository: baseEnv.HARMONIARR_REPOSITORY, signerWorkflow: `${baseEnv.HARMONIARR_REPOSITORY}/.github/workflows/release-image.yml`,
    predicateType: publishedImagePredicateType, attestationCount: 1, verifiedAt: '2026-09-12T15:00:00.000Z' };
}

test('single-image provenance help has no verification or filesystem dependencies', async () => {
  assert.deepEqual(await runPublishedImageProvenanceCommand({ args: ['--help'], env: {},
    verify: async () => { assert.fail('Help must not verify'); } }), { help: true });
});

test('single-image provenance requires all explicit CI inputs and has no trust bypass flags', () => {
  for (const key of Object.keys(baseEnv)) {
    assert.throws(() => parsePublishedImageProvenanceInputs({ args: [], env: { ...baseEnv, [key]: '' } }), /required/u);
  }
  for (const flag of ['--allow-local-images', '--skip-provenance', '--verification-json', '--source-digest', '--signer-workflow']) {
    assert.throws(() => parsePublishedImageProvenanceInputs({ args: [flag], env: baseEnv }), /Unsupported/u);
  }
  const inputs = parsePublishedImageProvenanceInputs({ args: [], env: baseEnv });
  assert.equal(inputs.imageRef, baseEnv.HARMONIARR_IMAGE);
  assert.equal(inputs.revision, baseEnv.HARMONIARR_IMAGE_REVISION);
});

test('single-image CLI reserves evidence, rejects incomplete proof and writes an allowlisted result', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'harmoniarr-image-provenance-'));
  try {
    const existing = join(directory, 'existing.json');
    await writeFile(existing, 'existing proof');
    await assert.rejects(runPublishedImageProvenanceCommand({ args: [],
      env: { ...baseEnv, HARMONIARR_PROVENANCE_EVIDENCE_PATH: existing },
      verify: async () => { assert.fail('Existing evidence must prevent verification'); },
    }), /new writable/u);
    assert.equal(await readFile(existing, 'utf8'), 'existing proof');

    const passed = passedProof();
    let index = 0;
    for (const invalid of [null, { ...passed, provenanceVerified: false }, { ...passed, reference: 'another-image' },
      { ...passed, revision: '0'.repeat(40) }, { ...passed, signerWorkflow: 'another-workflow' },
      { ...passed, attestationCount: 0 }, { ...passed, verifiedAt: 'invalid' }]) {
      const path = join(directory, `invalid-${index++}.json`);
      await assert.rejects(runPublishedImageProvenanceCommand({ args: [],
        env: { ...baseEnv, HARMONIARR_PROVENANCE_EVIDENCE_PATH: path }, verify: async () => invalid,
      }), /no image execution/u);
      assert.equal(await readFile(path, 'utf8'), '');
    }

    const rejectedPath = join(directory, 'rejected.json');
    await assert.rejects(runPublishedImageProvenanceCommand({ args: [],
      env: { ...baseEnv, HARMONIARR_PROVENANCE_EVIDENCE_PATH: rejectedPath },
      verify: async () => { throw new Error('PRIVATE_TOKEN_FIXTURE'); },
    }), (error) => !error.message.includes('PRIVATE_'));
    assert.equal(await readFile(rejectedPath, 'utf8'), '');

    const path = join(directory, 'passed.json');
    const env = { ...baseEnv, HARMONIARR_PROVENANCE_EVIDENCE_PATH: path, GH_TOKEN: 'PRIVATE_TOKEN_FIXTURE' };
    const result = await runPublishedImageProvenanceCommand({ args: [], env, verify: async (inputs, options) => {
      assert.equal(inputs.imageRef, env.HARMONIARR_IMAGE);
      assert.equal(inputs.revision, env.HARMONIARR_IMAGE_REVISION);
      assert.equal(options.env, env);
      return { ...passed, rawAttestation: 'PRIVATE_PREDICATE_FIXTURE', token: 'PRIVATE_TOKEN_FIXTURE' };
    } });
    assert.deepEqual(result, passed);
    assert.deepEqual(JSON.parse(await readFile(path, 'utf8')), passed);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
