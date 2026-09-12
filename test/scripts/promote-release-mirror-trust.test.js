import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createMirrorTagCopyReference,
  promoteReleaseMirrorTrust,
} from '../../scripts/promote-release-mirror-trust.js';

const metadata = {
  imageName: 'ghcr.io/cloudbyday90/harmoniarr',
  immutableImageRef: 'ghcr.io/cloudbyday90/harmoniarr@sha256:root',
  mirrors: {
    dockerHub: {
      imageName: 'cloudbyday90/harmoniarr',
      immutableImageRef: 'cloudbyday90/harmoniarr@sha256:root',
      tags: [
        'cloudbyday90/harmoniarr:0.1.0-beta',
        'cloudbyday90/harmoniarr:v0.1.0-beta',
      ],
    },
  },
};

const plan = {
  canonicalRegistry: 'ghcr',
  registries: {
    dockerHub: {
      imageName: 'cloudbyday90/harmoniarr',
      key: 'dockerHub',
    },
    ghcr: {
      imageName: 'ghcr.io/cloudbyday90/harmoniarr',
      key: 'ghcr',
    },
  },
};

test('createMirrorTagCopyReference joins release tags for ORAS copy', () => {
  assert.equal(
    createMirrorTagCopyReference('cloudbyday90/harmoniarr', metadata.mirrors.dockerHub.tags),
    'cloudbyday90/harmoniarr:0.1.0-beta,v0.1.0-beta',
  );
});

test('promoteReleaseMirrorTrust copies the canonical digest to mirror tags', async () => {
  const calls = [];

  const result = await promoteReleaseMirrorTrust({
    copyOrasArtifactGraphFn: async (options) => {
      calls.push(options);
      return {
        toReference: options.toReference,
        usedFallback: false,
        usedTargetDistributionSpec: 'v1.1-referrers-api',
      };
    },
    metadata,
    plan,
  });

  assert.equal(result.toReference, 'cloudbyday90/harmoniarr:0.1.0-beta,v0.1.0-beta');
  assert.equal(calls[0].fromReference, metadata.immutableImageRef);
});
test('staged mirror referrer copying writes only a run-specific candidate tag', async () => {
  const stagingTag = `candidate-${'a'.repeat(40)}-123-2`;
  const calls = [];
  await promoteReleaseMirrorTrust({ metadata, plan, stagingTag,
    copyOrasArtifactGraphFn: async (options) => { calls.push(options); return {}; } });
  assert.equal(calls[0].toReference, `cloudbyday90/harmoniarr:${stagingTag}`);
  assert.equal(calls[0].fromReference, metadata.immutableImageRef);
  for (const invalidTag of ['', 'latest', 'v0.1.0-beta', `${stagingTag},latest`, `candidate-${'a'.repeat(40)}-0-2`]) {
    await assert.rejects(promoteReleaseMirrorTrust({ metadata, plan, stagingTag: invalidTag,
      copyOrasArtifactGraphFn: async () => { assert.fail('Invalid staging tag must prevent copying'); } }), /candidate tag/);
  }
});
