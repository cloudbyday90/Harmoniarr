import assert from 'node:assert/strict';
import test from 'node:test';

import {
  collectOrasReferrers,
  copyOrasArtifactGraph,
  createOrasDescriptorIdentity,
  discoverRegistryReferrers,
  parseOrasDiscoverOutput,
} from '../../scripts/oras-registry.js';

const ghcrBinding = {
  auth: {
    required: false,
    tokenEnvName: 'GITHUB_TOKEN',
    usernameEnvName: 'GITHUB_ACTOR',
  },
  key: 'ghcr',
  referrersPlan: {
    distributionSpec: 'v1.1-referrers-api',
    fallbackDistributionSpec: null,
    hasFallbackDistributionSpec: false,
  },
};

const dockerHubBinding = {
  auth: {
    required: true,
    tokenEnvName: 'DOCKERHUB_TOKEN',
    usernameEnvName: 'DOCKERHUB_USERNAME',
  },
  key: 'dockerHub',
  referrersPlan: {
    distributionSpec: 'v1.1-referrers-api',
    fallbackDistributionSpec: 'v1.1-referrers-tag',
    hasFallbackDistributionSpec: true,
  },
};

const discoverJson = JSON.stringify({
  digest: 'sha256:root',
  mediaType: 'application/vnd.oci.image.index.v1+json',
  reference: 'ghcr.io/cloudbyday90/harmoniarr@sha256:root',
  referrers: [
    {
      artifactType: 'application/spdx+json',
      digest: 'sha256:sbom',
      mediaType: 'application/vnd.oci.image.manifest.v1+json',
      reference: 'ghcr.io/cloudbyday90/harmoniarr@sha256:sbom',
      referrers: [
        {
          artifactType: 'application/vnd.cncf.notary.signature',
          digest: 'sha256:sig',
          mediaType: 'application/vnd.oci.image.manifest.v1+json',
          reference: 'ghcr.io/cloudbyday90/harmoniarr@sha256:sig',
        },
      ],
    },
  ],
});

test('parseOrasDiscoverOutput and collectOrasReferrers normalize recursive referrers', () => {
  const parsed = parseOrasDiscoverOutput(discoverJson);

  assert.equal(parsed.digest, 'sha256:root');
  assert.deepEqual(collectOrasReferrers(parsed).map((descriptor) => descriptor.digest), ['sha256:sbom', 'sha256:sig']);
  assert.equal(createOrasDescriptorIdentity(parsed.referrers[0]), 'sha256:sbom|application/spdx+json|application/vnd.oci.image.manifest.v1+json');
});

test('discoverRegistryReferrers retries with fallback distribution spec when configured', async () => {
  const calls = [];
  const result = await discoverRegistryReferrers('cloudbyday90/harmoniarr@sha256:root', {
    env: {
      DOCKERHUB_TOKEN: 'secret',
      DOCKERHUB_USERNAME: 'alice',
    },
    registryBinding: dockerHubBinding,
    runOrasDiscoverFn: async (_reference, options) => {
      calls.push(options.referrersPlan.distributionSpec);
      if (options.referrersPlan.distributionSpec === 'v1.1-referrers-api') {
        throw new Error('api unsupported');
      }

      return parseOrasDiscoverOutput(discoverJson);
    },
  });

  assert.deepEqual(calls, ['v1.1-referrers-api', 'v1.1-referrers-tag']);
  assert.equal(result.usedFallback, true);
  assert.equal(result.usedDistributionSpec, 'v1.1-referrers-tag');
});

test('copyOrasArtifactGraph retries target copy with fallback distribution spec', async () => {
  const calls = [];
  const result = await copyOrasArtifactGraph({
    env: {
      DOCKERHUB_TOKEN: 'secret',
      DOCKERHUB_USERNAME: 'alice',
      GITHUB_ACTOR: 'copilot',
      GITHUB_TOKEN: 'gh-token',
    },
    fromReference: 'ghcr.io/cloudbyday90/harmoniarr@sha256:root',
    runCommandFn: async (options) => {
      calls.push(options.args);
      const targetDistributionSpec = options.args[options.args.indexOf('--to-distribution-spec') + 1];
      if (targetDistributionSpec === 'v1.1-referrers-api') {
        throw new Error('target api unsupported');
      }

      return { stdout: '' };
    },
    sourceRegistryBinding: ghcrBinding,
    targetRegistryBinding: dockerHubBinding,
    toReference: 'cloudbyday90/harmoniarr:0.1.0-beta,v0.1.0-beta',
  });

  assert.equal(result.usedFallback, true);
  assert.equal(result.usedTargetDistributionSpec, 'v1.1-referrers-tag');
  assert.equal(calls.length, 2);
  assert.ok(calls[1].includes('v1.1-referrers-tag'));
});