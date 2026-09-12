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
import { runReleaseImageTagPromotionCommand } from '../../scripts/promote-release-image-tags.js';
import { runReleaseCandidateTagCommand } from '../../scripts/write-release-candidate-tags.js';

const digest = `sha256:${'b'.repeat(64)}`;
const revision = 'a'.repeat(40);
const env = Object.freeze({ HARMONIARR_REPOSITORY: 'cloudbyday90/Harmoniarr', GITHUB_REPOSITORY: 'cloudbyday90/Harmoniarr',
  HARMONIARR_RELEASE_TAG: 'v1.2.3-beta', HARMONIARR_RELEASE_REVISION: revision, GITHUB_SHA: revision,
  GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_RUN_ID: '42', GITHUB_RUN_ATTEMPT: '2',
  HARMONIARR_IMAGE: `ghcr.io/cloudbyday90/harmoniarr@${digest}` });
const passed = { schemaVersion: 1, validationKind: 'release-image-tag-promotion', status: 'passed',
  repository: env.HARMONIARR_REPOSITORY, releaseTag: env.HARMONIARR_RELEASE_TAG, sourceRevision: revision,
  imageRef: env.HARMONIARR_IMAGE, digest, sourceDigestsVerified: true, aliasesVerified: true,
  registries: [{ registry: 'ghcr', source: env.HARMONIARR_IMAGE, digest,
    targets: ['ghcr.io/cloudbyday90/harmoniarr:1.2.3-beta', 'ghcr.io/cloudbyday90/harmoniarr:v1.2.3-beta'] }],
  verifiedAt: '2026-09-12T15:00:00.000Z' };

test('candidate and promotion help is inert and unsupported bypass options fail before mutation', async () => {
  for (const run of [runReleaseCandidateTagCommand, runReleaseImageTagPromotionCommand]) {
    assert.deepEqual(await run({ args: ['--help'], env: {} }), { help: true });
    for (const flag of ['--skip-verification', '--allow-local', '--force', '--rollback']) {
      await assert.rejects(run({ args: [flag], env }), /Unsupported/u);
    }
  }
});

test('both commands require native dispatch identity matching the repository and full source revision', async () => {
  for (const run of [runReleaseCandidateTagCommand, runReleaseImageTagPromotionCommand]) {
    for (const patch of [{ GITHUB_EVENT_NAME: 'release' }, { GITHUB_SHA: 'd'.repeat(40) },
      { GITHUB_REPOSITORY: 'another/repository' }, { HARMONIARR_RELEASE_REVISION: '' },
      { HARMONIARR_REPOSITORY: 'another/repository' }]) {
      await assert.rejects(run({ args: [], env: { ...env, ...patch }, promote: async () => {
        assert.fail('Invalid workflow identity must prevent mutation');
      } }));
    }
  }
});

test('candidate planning emits only attempt-bound staging tags and requires writable workflow outputs', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'harmoniarr-tag-cli-'));
  try {
    const path = join(directory, 'github-output');
    const result = await runReleaseCandidateTagCommand({ args: [], env: { ...env, GITHUB_OUTPUT: path,
      HARMONIARR_DOCKERHUB_IMAGE_NAME: 'cloudbyday90/harmoniarr' } });
    const candidateTag = `candidate-${revision}-42-2`;
    assert.equal(result.candidateTag, candidateTag);
    assert.deepEqual(result.candidateTags, [`ghcr.io/cloudbyday90/harmoniarr:${candidateTag}`, `cloudbyday90/harmoniarr:${candidateTag}`]);
    const output = await readFile(path, 'utf8');
    assert.ok(output.startsWith(`candidate_tag=${candidateTag}\n`));
    assert.ok(output.includes(`\nghcr.io/cloudbyday90/harmoniarr:${candidateTag}\ncloudbyday90/harmoniarr:${candidateTag}\n`));
    assert.equal(output.includes(':latest'), false);
    await assert.rejects(runReleaseCandidateTagCommand({ args: [], env }), /output file is required/u);
    await assert.rejects(runReleaseCandidateTagCommand({ args: [], env: { ...env, GITHUB_OUTPUT: directory } }),
      (error) => error.message === 'Candidate tag outputs could not be written');
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('promotion reserves a new evidence file before registry writes and never overwrites previous proof', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'harmoniarr-tag-cli-'));
  try {
    const path = join(directory, 'existing.json');
    await writeFile(path, 'original evidence');
    await assert.rejects(runReleaseImageTagPromotionCommand({ args: [], env: { ...env, HARMONIARR_TAG_PROMOTION_EVIDENCE_PATH: path },
      promote: async () => { assert.fail('Existing evidence must prevent mutation'); } }), /new writable/u);
    assert.equal(await readFile(path, 'utf8'), 'original evidence');
    await assert.rejects(runReleaseImageTagPromotionCommand({ args: [], env,
      promote: async () => { assert.fail('Missing evidence must prevent mutation'); } }), /evidence path is required/u);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('promotion rejects success not bound to exact source, release, registry and alias inventory', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'harmoniarr-tag-cli-'));
  try {
    let index = 0;
    for (const patch of [{ schemaVersion: 2 }, { validationKind: 'runtime-acceptance' }, { status: 'failed' },
      { repository: 'another/repo' }, { releaseTag: 'v1.2.4' }, { sourceRevision: 'd'.repeat(40) },
      { imageRef: 'unbound' }, { digest: `sha256:${'c'.repeat(64)}` }, { sourceDigestsVerified: false },
      { aliasesVerified: false }, { verifiedAt: 'not-a-date' }, { registries: [] },
      { registries: [{ ...passed.registries[0], source: 'unbound' }] },
      { registries: [{ ...passed.registries[0], digest: `sha256:${'c'.repeat(64)}` }] },
      { registries: [{ ...passed.registries[0], targets: [...passed.registries[0].targets, 'ghcr.io/cloudbyday90/harmoniarr:latest'] }] },
      { registries: [{ ...passed.registries[0], targets: [...passed.registries[0].targets].reverse() }] }]) {
      const path = join(directory, `bad-${index++}.json`);
      await assert.rejects(runReleaseImageTagPromotionCommand({ args: [], env: { ...env, HARMONIARR_TAG_PROMOTION_EVIDENCE_PATH: path },
        promote: async () => ({ ...passed, ...patch }) }), /aliases may have changed/u);
      assert.equal(await readFile(path, 'utf8'), '');
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('promotion writes only digest-binding proof and strips secrets and unrelated acceptance claims', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'harmoniarr-tag-cli-'));
  try {
    const path = join(directory, 'passed.json');
    const result = await runReleaseImageTagPromotionCommand({ args: [], env: { ...env, HARMONIARR_TAG_PROMOTION_EVIDENCE_PATH: path },
      promote: async (inputs) => {
        assert.equal(inputs.imageRef, env.HARMONIARR_IMAGE);
        assert.equal(inputs.revision, revision);
        return { ...passed, token: 'PRIVATE_FIXTURE', provenanceVerified: true, acceptanceVerified: true,
          registries: passed.registries.map((registry) => ({ ...registry, raw: 'PRIVATE_MANIFEST_FIXTURE' })) };
      } });
    assert.deepEqual(result, passed);
    assert.deepEqual(JSON.parse(await readFile(path, 'utf8')), passed);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('an ambiguous registry failure leaves no success evidence and exposes no private diagnostic', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'harmoniarr-tag-cli-'));
  try {
    const path = join(directory, 'failed.json');
    await assert.rejects(runReleaseImageTagPromotionCommand({ args: [], env: { ...env, HARMONIARR_TAG_PROMOTION_EVIDENCE_PATH: path },
      promote: async () => { throw new Error('PRIVATE_REGISTRY_DIAGNOSTIC_FIXTURE'); } }),
    (error) => error.message.includes('aliases may have changed') && !error.message.includes('PRIVATE_'));
    assert.equal(await readFile(path, 'utf8'), '');
  } finally { await rm(directory, { recursive: true, force: true }); }
});
