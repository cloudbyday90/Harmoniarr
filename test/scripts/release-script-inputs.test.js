import assert from 'node:assert/strict';
import test from 'node:test';

import {
  resolveImageRegistryPlanInputs,
  resolveReleaseContractInputs,
  resolveReleaseMirrorInputs,
  resolveWriteReleaseMetadataInputs,
} from '../../scripts/release-script-inputs.js';

test('resolveImageRegistryPlanInputs prefers CLI flags over environment values', () => {
  const inputs = resolveImageRegistryPlanInputs({
    args: [
      '--release-tag', 'v1.2.3',
      '--repository-name', 'cli-repo',
      '--repository-owner', 'cli-owner',
      '--enable-dockerhub',
      '--dockerhub-namespace', 'cli-namespace',
    ],
    env: {
      HARMONIARR_ENABLE_DOCKERHUB: 'false',
      HARMONIARR_RELEASE_TAG: 'v0.9.0',
      HARMONIARR_REPOSITORY_NAME: 'env-repo',
      HARMONIARR_REPOSITORY_OWNER: 'env-owner',
    },
  });

  assert.equal(inputs.releaseTag, 'v1.2.3');
  assert.equal(inputs.repositoryName, 'cli-repo');
  assert.equal(inputs.repositoryOwner, 'cli-owner');
  assert.equal(inputs.enableDockerHub, true);
  assert.equal(inputs.dockerHubNamespace, 'cli-namespace');
});

test('resolveReleaseMirrorInputs keeps dockerHub as the default mirror', () => {
  const inputs = resolveReleaseMirrorInputs({
    args: ['--metadata-path', 'release.json'],
    env: {},
  });

  assert.equal(inputs.metadataPath, 'release.json');
  assert.equal(inputs.mirrorName, 'dockerHub');
  assert.equal(inputs.expectedDigest, null);
});

test('resolveReleaseContractInputs trims CLI string overrides', () => {
  const inputs = resolveReleaseContractInputs({
    args: [
      '--metadata-path', '  metadata.json  ',
      '--release-view-path', ' release-view.json ',
      '--expected-release-tag', ' v1.2.3 ',
    ],
    env: {},
  });

  assert.equal(inputs.metadataPath, 'metadata.json');
  assert.equal(inputs.releaseViewPath, 'release-view.json');
  assert.equal(inputs.expectedReleaseTag, 'v1.2.3');
});

test('resolveWriteReleaseMetadataInputs falls back to environment and default directory', () => {
  const inputs = resolveWriteReleaseMetadataInputs({
    env: {
      GITHUB_REPOSITORY: 'CloudByDay90/Harmoniarr',
      HARMONIARR_RELEASE_DIGEST: 'sha256:root',
      HARMONIARR_RELEASE_IMAGE_NAME: 'ghcr.io/cloudbyday90/harmoniarr',
      HARMONIARR_RELEASE_TAG: 'v1.2.3',
      HARMONIARR_RELEASE_VERSION: '1.2.3',
    },
  });

  assert.equal(inputs.directory, 'supply-chain');
  assert.equal(inputs.repository, 'CloudByDay90/Harmoniarr');
  assert.equal(inputs.tagsText, '');
});