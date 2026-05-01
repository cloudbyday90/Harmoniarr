import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  resolveImageRegistryPlanFromEnvironment,
  writeImageRegistryPlanToGitHubOutput,
} from '../../scripts/write-image-registry-config.js';

test('resolveImageRegistryPlanFromEnvironment resolves structured registry keys', () => {
  const plan = resolveImageRegistryPlanFromEnvironment({
    HARMONIARR_DOCKERHUB_NAMESPACE: 'CloudByDay90',
    HARMONIARR_ENABLE_DOCKERHUB: 'true',
    HARMONIARR_ENABLE_TRUSTED_DOCKERHUB_MIRROR: 'true',
    HARMONIARR_RELEASE_TAG: 'v0.1.0-beta',
    HARMONIARR_REPOSITORY_NAME: 'Harmoniarr',
    HARMONIARR_REPOSITORY_OWNER: 'CloudByDay90',
  });

  assert.equal(plan.canonicalRegistry, 'ghcr');
  assert.deepEqual(plan.enabledRegistryKeys, ['ghcr', 'dockerHub']);
  assert.deepEqual(plan.mirrorRegistryKeys, ['dockerHub']);
  assert.equal(plan.trustedDockerHubMirrorEnabled, true);
});

test('resolveImageRegistryPlanFromEnvironment accepts native CLI overrides', () => {
  const plan = resolveImageRegistryPlanFromEnvironment({
    HARMONIARR_ENABLE_DOCKERHUB: 'false',
    HARMONIARR_REPOSITORY_NAME: 'Harmoniarr',
    HARMONIARR_REPOSITORY_OWNER: 'CloudByDay90',
  }, {
    args: [
      '--enable-dockerhub',
      '--enable-trusted-dockerhub-mirror',
      '--release-tag', 'v0.1.0-beta',
      '--dockerhub-namespace', 'CloudByDay90',
    ],
  });

  assert.deepEqual(plan.enabledRegistryKeys, ['ghcr', 'dockerHub']);
  assert.equal(plan.trustedDockerHubMirrorEnabled, true);
  assert.equal(plan.releaseTag, 'v0.1.0-beta');
});

test('writeImageRegistryPlanToGitHubOutput emits structured registry plan fields', async () => {
  const tempDirectory = await mkdtemp(join(tmpdir(), 'harmoniarr-image-registry-config-'));
  const outputPath = join(tempDirectory, 'github-output.txt');

  try {
    await writeImageRegistryPlanToGitHubOutput(resolveImageRegistryPlanFromEnvironment({
      HARMONIARR_DOCKERHUB_NAMESPACE: 'CloudByDay90',
      HARMONIARR_ENABLE_DOCKERHUB: 'true',
      HARMONIARR_ENABLE_TRUSTED_DOCKERHUB_MIRROR: 'true',
      HARMONIARR_RELEASE_TAG: 'v0.1.0-beta',
      HARMONIARR_REPOSITORY_NAME: 'Harmoniarr',
      HARMONIARR_REPOSITORY_OWNER: 'CloudByDay90',
    }), outputPath);

    const output = await readFile(outputPath, 'utf8');

    assert.match(output, /^canonical_registry=ghcr/m);
    assert.match(output, /^canonical_referrers_distribution_spec=v0?1\.1-referrers-api$/m);
    assert.match(output, /^canonical_referrers_fallback_distribution_spec=$/m);
    assert.match(output, /^enabled_registry_keys=ghcr,dockerHub/m);
    assert.match(output, /^mirror_registry_keys=dockerHub/m);
    assert.match(output, /^dockerhub_image_name=cloudbyday90\/harmoniarr/m);
    assert.match(output, /^dockerhub_referrers_distribution_spec=v0?1\.1-referrers-api$/m);
    assert.match(output, /^dockerhub_referrers_fallback_distribution_spec=v0?1\.1-referrers-tag$/m);
    assert.match(output, /^trusted_dockerhub_mirror_enabled=true$/m);
    assert.match(output, /^release_tag=v0\.1\.0-beta/m);
  } finally {
    await rm(tempDirectory, { force: true, recursive: true });
  }
});