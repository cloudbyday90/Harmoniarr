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
import { parsePublishedCandidateOptions, runPublishedCandidateCommand } from '../../scripts/validate-published-docker-candidate.js';

const args = ['--candidate-image', `ghcr.io/cloudbyday90/harmoniarr@sha256:${'a'.repeat(64)}`,
  '--baseline-image', `ghcr.io/cloudbyday90/harmoniarr@sha256:${'b'.repeat(64)}`,
  '--candidate-revision', 'c'.repeat(40), '--baseline-revision', 'd'.repeat(40), '--baseline-release-tag', 'v0.1.0-beta'];
const passed = { validationKind: 'published-candidate-acceptance', status: 'passed',
  provenanceVerified: true, publishedBaselineVerified: true, acceptedReleaseBaselineVerified: false, cleanupVerified: true };

test('published candidate help has no side effects and offers no trust bypass flags', async () => {
  assert.deepEqual(await runPublishedCandidateCommand({ args: ['--help'], validate: () => assert.fail('unexpected verification') }), { help: true });
  assert.throws(() => parsePublishedCandidateOptions([]), /required/);
  for (const bypass of ['--allow-local-images', '--skip-provenance', '--accepted-baseline', '--verification-json']) {
    assert.throws(() => parsePublishedCandidateOptions([...args, '--evidence-path', 'out.json', bypass]), /Unsupported/);
  }
  assert.equal(parsePublishedCandidateOptions([...args, '--evidence-path', 'out.json']).repository, 'cloudbyday90/Harmoniarr');
});

test('published command never overwrites evidence and leaves trust/runtime failures without a passed record', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'harmoniarr-published-command-'));
  try {
    const existing = join(directory, 'existing.json');
    await writeFile(existing, 'existing proof');
    await assert.rejects(runPublishedCandidateCommand({ args: [...args, '--evidence-path', existing],
      validate: () => assert.fail('must reserve first') }), /new writable/);
    assert.equal(await readFile(existing, 'utf8'), 'existing proof');
    let index = 0;
    for (const incomplete of [null, { ...passed, provenanceVerified: false }, { ...passed, publishedBaselineVerified: false },
      { ...passed, cleanupVerified: false }, { ...passed, validationKind: 'immutable-candidate-acceptance' }]) {
      const path = join(directory, `incomplete-${index++}.json`);
      await assert.rejects(runPublishedCandidateCommand({ args: [...args, '--evidence-path', path], validate: async () => incomplete }), /no release acceptance/);
      assert.equal(await readFile(path, 'utf8'), '');
    }
    const rejected = join(directory, 'rejected.json');
    await assert.rejects(runPublishedCandidateCommand({ args: [...args, '--evidence-path', rejected],
      validate: async () => { throw new Error('credential PRIVATE_FIXTURE_SECRET'); } }),
    (error) => !error.message.includes('PRIVATE_FIXTURE_SECRET'));
    assert.equal(await readFile(rejected, 'utf8'), '');
    const path = join(directory, 'passed.json');
    await runPublishedCandidateCommand({ args: [...args, '--evidence-path', path], validate: async () => passed });
    assert.deepEqual(JSON.parse(await readFile(path, 'utf8')), passed);
  } finally { await rm(directory, { force: true, recursive: true }); }
});
