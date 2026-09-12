/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { assertReleaseCandidateTag, createReleaseCandidateTagPlan, createReleaseImagePromotionPlan } from '../../scripts/release-image-tag-plan.js';

const inputs = { repository: 'cloudbyday90/Harmoniarr', releaseTag: 'v1.2.3-beta', revision: 'a'.repeat(40),
  dockerHubImageName: 'cloudbyday90/harmoniarr' };

test('candidate tags bind the full source, run and attempt without release aliases', () => {
  const plan = createReleaseCandidateTagPlan({ ...inputs, runId: '12345', runAttempt: '2' });
  const expected = `candidate-${inputs.revision}-12345-2`;
  assert.equal(plan.candidateTag, expected);
  assert.equal(assertReleaseCandidateTag(expected), expected);
  assert.deepEqual(plan.candidateTags, [`ghcr.io/cloudbyday90/harmoniarr:${expected}`, `cloudbyday90/harmoniarr:${expected}`]);
  assert.equal(plan.candidateTags.some((tag) => tag.endsWith(':latest') || tag.endsWith(':v1.2.3-beta')), false);
  assert.notEqual(createReleaseCandidateTagPlan({ ...inputs, runId: '12345', runAttempt: '3' }).candidateTag, expected);
});

test('candidate tag validation rejects ambiguous identifiers and registry injection', () => {
  for (const patch of [{ runId: '0' }, { runAttempt: '01' }, { runId: '1\nother' },
    { runAttempt: '1'.repeat(21) }, { dockerHubImageName: 'evil.example/repo' },
    { dockerHubImageName: 'localhost/repo' },
    { dockerHubImageName: 'other/repo:latest' }, { revision: 'abcdef0' }]) {
    assert.throws(() => createReleaseCandidateTagPlan({ ...inputs, runId: '1', runAttempt: '1', ...patch }));
  }
});

for (const [releaseTag, expectedAliases] of [
  ['v1.2.3-beta', ['1.2.3-beta', 'v1.2.3-beta']],
  ['v1.2.3', ['1.2.3', 'v1.2.3', 'latest']],
  ['1.2.3', ['1.2.3', 'latest']],
]) {
  test(`promotion derives only intended aliases for ${releaseTag}`, () => {
    const imageRef = `ghcr.io/cloudbyday90/harmoniarr@sha256:${'b'.repeat(64)}`;
    const plan = createReleaseImagePromotionPlan({ ...inputs, releaseTag, imageRef });
    assert.equal(plan.sources.length, 2);
    for (const source of plan.sources) {
      assert.equal(source.source, `${source.imageName}@sha256:${'b'.repeat(64)}`);
      assert.deepEqual(source.targets, expectedAliases.map((tag) => `${source.imageName}:${tag}`));
    }
  });
}

test('promotion refuses mutable or substituted canonical source references', () => {
  for (const imageRef of ['ghcr.io/cloudbyday90/harmoniarr:latest', `sha256:${'b'.repeat(64)}`,
    `ghcr.io/other/repository@sha256:${'b'.repeat(64)}`]) {
    assert.throws(() => createReleaseImagePromotionPlan({ ...inputs, imageRef }));
  }
});
