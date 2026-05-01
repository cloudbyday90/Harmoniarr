import assert from 'node:assert/strict';
import test from 'node:test';

import {
  verifyDiscoveredReferrerGraphs,
  verifyReleaseMirrorReferrers,
} from '../../scripts/verify-release-mirror-referrers.js';

const sourceDiscovery = {
  digest: 'sha256:root',
  referrers: [
    {
      artifactType: 'application/spdx+json',
      digest: 'sha256:sbom',
      mediaType: 'application/vnd.oci.image.manifest.v1+json',
      reference: 'ghcr.io/cloudbyday90/harmoniarr@sha256:sbom',
      referrers: [],
    },
  ],
  reference: 'ghcr.io/cloudbyday90/harmoniarr@sha256:root',
};

const targetDiscovery = {
  digest: 'sha256:root',
  referrers: [
    {
      artifactType: 'application/spdx+json',
      digest: 'sha256:sbom',
      mediaType: 'application/vnd.oci.image.manifest.v1+json',
      reference: 'cloudbyday90/harmoniarr@sha256:sbom',
      referrers: [],
    },
  ],
  reference: 'cloudbyday90/harmoniarr@sha256:root',
};

const metadataForVerification = {
  digest: 'sha256:root',
  imageName: 'ghcr.io/cloudbyday90/harmoniarr',
  immutableImageRef: 'ghcr.io/cloudbyday90/harmoniarr@sha256:root',
  mirrors: {
    dockerHub: {
      imageName: 'cloudbyday90/harmoniarr',
      immutableImageRef: 'cloudbyday90/harmoniarr@sha256:root',
    },
  },
};

const planForVerification = {
  canonicalRegistry: 'ghcr',
  registries: {
    dockerHub: { key: 'dockerHub' },
    ghcr: { key: 'ghcr' },
  },
};

test('verifyDiscoveredReferrerGraphs rejects missing trusted mirror referrers', () => {
  assert.throws(
    () => verifyDiscoveredReferrerGraphs({
      expectedDigest: 'sha256:root',
      sourceDiscovery,
      targetDiscovery: { ...targetDiscovery, referrers: [] },
    }),
    /Missing referrers/,
  );
});

test('verifyReleaseMirrorReferrers compares canonical and mirror discovery graphs', async () => {
  const calls = [];
  const result = await verifyReleaseMirrorReferrers({
    discoverRegistryReferrersFn: async (reference, options) => {
      calls.push({ key: options.registryBinding.key, reference });
      return options.registryBinding.key === 'ghcr'
        ? { discovery: sourceDiscovery, usedDistributionSpec: 'v1.1-referrers-api', usedFallback: false }
        : { discovery: targetDiscovery, usedDistributionSpec: 'v1.1-referrers-tag', usedFallback: true };
    },
    expectedDigest: 'sha256:root',
    metadata: metadataForVerification,
    plan: planForVerification,
  });

  assert.equal(result.referrerCount, 1);
  assert.equal(result.usedTargetDistributionSpec, 'v1.1-referrers-tag');
  assert.equal(result.usedTargetFallback, true);
  assert.deepEqual(calls, [
    { key: 'ghcr', reference: 'ghcr.io/cloudbyday90/harmoniarr@sha256:root' },
    { key: 'dockerHub', reference: 'cloudbyday90/harmoniarr@sha256:root' },
  ]);
});