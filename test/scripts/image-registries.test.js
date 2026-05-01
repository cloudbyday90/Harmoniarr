import assert from 'node:assert/strict';
import test from 'node:test';

import {
  listEnabledRegistryBindings,
  resolveImageRegistries,
  resolveReleaseImagePlan,
} from '../../scripts/image-registries.js';

test('resolveImageRegistries returns GHCR and Docker Hub image names when Docker Hub is enabled', () => {
  const plan = resolveImageRegistries({
    dockerHubNamespace: 'CloudByDay90',
    enableDockerHub: true,
    enableTrustedDockerHubMirror: true,
    repositoryName: 'Harmoniarr',
    repositoryOwner: 'CloudByDay90',
  });

  assert.equal(plan.imageName, 'ghcr.io/cloudbyday90/harmoniarr');
  assert.equal(plan.dockerHubImageName, 'cloudbyday90/harmoniarr');
  assert.deepEqual(plan.publishImageNames, [
    'ghcr.io/cloudbyday90/harmoniarr',
    'cloudbyday90/harmoniarr',
  ]);
  assert.equal(plan.dockerMetadataImages, 'ghcr.io/cloudbyday90/harmoniarr\ncloudbyday90/harmoniarr');
  assert.equal(plan.canonicalRegistry, 'ghcr');
  assert.deepEqual(plan.enabledRegistryKeys, ['ghcr', 'dockerHub']);
  assert.deepEqual(plan.mirrorRegistryKeys, ['dockerHub']);
  assert.equal(plan.trustedDockerHubMirrorEnabled, true);
  assert.deepEqual(plan.registries.ghcr, {
    attestationSource: true,
    auth: {
      required: false,
      tokenEnvName: 'GITHUB_TOKEN',
      usernameEnvName: 'GITHUB_ACTOR',
    },
    displayName: 'GHCR',
    enabled: true,
    imageName: 'ghcr.io/cloudbyday90/harmoniarr',
    isCanonical: true,
    key: 'ghcr',
    namespace: 'ghcr.io',
    referrersPlan: {
      distributionSpec: 'v1.1-referrers-api',
      fallbackDistributionSpec: null,
      hasFallbackDistributionSpec: false,
    },
    referrersDiscovery: 'same_registry',
    repository: 'harmoniarr',
    role: 'canonical',
    sbomDelivery: 'release_asset',
    verification: 'attestation_and_digest',
  });
  assert.deepEqual(plan.registries.dockerHub, {
    attestationSource: false,
    auth: {
      required: true,
      tokenEnvName: 'DOCKERHUB_TOKEN',
      usernameEnvName: 'DOCKERHUB_USERNAME',
    },
    displayName: 'Docker Hub',
    enabled: true,
    imageName: 'cloudbyday90/harmoniarr',
    isCanonical: false,
    key: 'dockerHub',
    namespace: 'cloudbyday90',
    promotionCandidate: 'oras_copy_recursive',
    promotionVerification: 'digest_and_referrers',
    referrerPolicy: 'not_mirrored',
    referrersPlan: {
      distributionSpec: 'v1.1-referrers-api',
      fallbackDistributionSpec: 'v1.1-referrers-tag',
      hasFallbackDistributionSpec: true,
    },
    referrersDiscovery: 'oci_1_1_or_referrers_tag',
    repository: 'harmoniarr',
    role: 'mirror',
    trustMode: 'runtime_only',
    verification: 'digest_parity',
  });
});

test('resolveImageRegistries falls back to GHCR only when Docker Hub is disabled', () => {
  const plan = resolveImageRegistries({
    enableDockerHub: false,
    repositoryName: 'Harmoniarr',
    repositoryOwner: 'CloudByDay90',
  });

  assert.equal(plan.imageName, 'ghcr.io/cloudbyday90/harmoniarr');
  assert.equal(plan.dockerHubImageName, null);
  assert.deepEqual(plan.publishImageNames, ['ghcr.io/cloudbyday90/harmoniarr']);
  assert.deepEqual(plan.enabledRegistryKeys, ['ghcr']);
  assert.deepEqual(plan.mirrorRegistryKeys, []);
  assert.deepEqual(Object.keys(plan.registries), ['ghcr']);
  assert.equal(plan.trustedDockerHubMirrorEnabled, false);
});

test('resolveReleaseImagePlan derives version and prerelease state from the release tag', () => {
  const plan = resolveReleaseImagePlan({
    dockerHubNamespace: 'CloudByDay90',
    enableDockerHub: true,
    releaseTag: 'v0.1.0-beta',
    repositoryName: 'Harmoniarr',
    repositoryOwner: 'CloudByDay90',
  });

  assert.equal(plan.releaseTag, 'v0.1.0-beta');
  assert.equal(plan.version, '0.1.0-beta');
  assert.equal(plan.isPrerelease, true);
  assert.deepEqual(listEnabledRegistryBindings(plan).map((binding) => binding.key), ['ghcr', 'dockerHub']);
});

test('listEnabledRegistryBindings requires a plan object', () => {
  assert.throws(() => listEnabledRegistryBindings(), /plan must be an object/);
});