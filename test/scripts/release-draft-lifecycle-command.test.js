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
import { defaultReleaseAssetNames } from '../../scripts/release-contract.js';
import { parseReleaseDraftLifecycleInputs, runReleaseDraftLifecycleCommand } from '../../scripts/release-draft-lifecycle.js';

const env = Object.freeze({ HARMONIARR_REPOSITORY: 'cloudbyday90/Harmoniarr', GITHUB_REPOSITORY: 'cloudbyday90/Harmoniarr',
  HARMONIARR_RELEASE_TAG: 'v1.2.3-beta', HARMONIARR_RELEASE_REVISION: 'a'.repeat(40), GITHUB_SHA: 'a'.repeat(40),
  GITHUB_EVENT_NAME: 'workflow_dispatch', HARMONIARR_RELEASE_POLICY_TOKEN: 'PRIVATE_READ_TOKEN_FIXTURE',
  HARMONIARR_RELEASE_ID: '42', HARMONIARR_RELEASE_ASSET_DIR: 'assets',
  HARMONIARR_IMAGE: `ghcr.io/cloudbyday90/harmoniarr@sha256:${'b'.repeat(64)}`,
  HARMONIARR_RELEASE_PUBLICATION_EVIDENCE_PATH: 'unused.json' });
const passed = { schemaVersion: 1, validationKind: 'immutable-release-publication', status: 'passed',
  releaseId: 42, repository: env.HARMONIARR_REPOSITORY, releaseTag: env.HARMONIARR_RELEASE_TAG,
  sourceRevision: env.GITHUB_SHA, imageRef: env.HARMONIARR_IMAGE, draft: false, published: true, immutable: true,
  releaseAttestationVerified: true, prerelease: true, publishedAt: '2026-09-12T15:00:00Z',
  assets: Object.values(defaultReleaseAssetNames).map((name) => ({ name, size: 100, sha256: 'c'.repeat(64) })) };

test('release lifecycle help is inert and parser rejects source, event, policy and identifier bypasses', async () => {
  assert.deepEqual(await runReleaseDraftLifecycleCommand({ args: ['--help'], env: {} }), { help: true });
  for (const patch of [{ GITHUB_EVENT_NAME: 'release' }, { GITHUB_SHA: 'd'.repeat(40) },
    { GITHUB_REPOSITORY: 'another/repository' }, { HARMONIARR_RELEASE_POLICY_TOKEN: '' },
    { HARMONIARR_RELEASE_ID: '42x' }]) {
    assert.throws(() => parseReleaseDraftLifecycleInputs({ args: ['--mode', 'finalize'], env: { ...env, ...patch } }));
  }
  for (const flag of ['--clobber', '--skip-policy', '--create-tag', '--force']) {
    assert.throws(() => parseReleaseDraftLifecycleInputs({ args: ['--mode', 'prepare', flag], env }), /Unsupported/u);
  }
  assert.equal(parseReleaseDraftLifecycleInputs({ args: ['--mode', 'prepare'], env }).isPrerelease, true);
});

test('release preparation emits only a verified numeric release identifier', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'harmoniarr-release-cli-'));
  try {
    const path = join(directory, 'github-output');
    await runReleaseDraftLifecycleCommand({ args: ['--mode', 'prepare'], env: { ...env, GITHUB_OUTPUT: path },
      service: { prepareRelease: async () => ({ releaseId: 42, draft: true, sourceRevision: env.GITHUB_SHA, reusedDraft: false }) } });
    assert.equal(await readFile(path, 'utf8'), 'release_id=42\n');
  } finally { await rm(directory, { force: true, recursive: true }); }
});

test('release finalization reserves evidence and rejects unbound or incomplete results', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'harmoniarr-release-cli-'));
  try {
    const existing = join(directory, 'existing.json');
    await writeFile(existing, 'old evidence');
    await assert.rejects(runReleaseDraftLifecycleCommand({ args: ['--mode', 'finalize'],
      env: { ...env, HARMONIARR_RELEASE_PUBLICATION_EVIDENCE_PATH: existing },
      service: { finalizeRelease: async () => { assert.fail('Existing output must prevent publication'); } } }), /new writable/u);
    assert.equal(await readFile(existing, 'utf8'), 'old evidence');
    let index = 0;
    for (const patch of [{ immutable: false }, { releaseAttestationVerified: false }, { releaseId: 43 },
      { repository: 'another/repo' }, { releaseTag: 'another-tag' }, { sourceRevision: 'd'.repeat(40) },
      { imageRef: 'another-image' }, { validationKind: 'another-kind' }, { schemaVersion: 2 },
      { published: false }, { draft: true }, { assets: [] }]) {
      const path = join(directory, `bad-${index++}.json`);
      await assert.rejects(runReleaseDraftLifecycleCommand({ args: ['--mode', 'finalize'],
        env: { ...env, HARMONIARR_RELEASE_PUBLICATION_EVIDENCE_PATH: path },
        service: { finalizeRelease: async () => ({ ...passed, ...patch }) } }), /inspect the release/u);
      assert.equal(await readFile(path, 'utf8'), '');
    }
    const path = join(directory, 'passed.json');
    const result = await runReleaseDraftLifecycleCommand({ args: ['--mode', 'finalize'],
      env: { ...env, HARMONIARR_RELEASE_PUBLICATION_EVIDENCE_PATH: path }, service: { finalizeRelease: async () => ({
        ...passed, raw: 'PRIVATE_TOKEN_FIXTURE', assets: passed.assets.map((asset) => ({ ...asset, path: 'PRIVATE_PATH_FIXTURE' })),
      }) } });
    assert.deepEqual(result, passed);
    assert.deepEqual(JSON.parse(await readFile(path, 'utf8')), passed);
  } finally { await rm(directory, { force: true, recursive: true }); }
});
