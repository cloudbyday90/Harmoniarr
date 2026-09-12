import assert from 'node:assert/strict';
import test from 'node:test';
import { createReleaseMetadata } from '../../scripts/release-contract.js';
import { verifyStagedReleaseMirror } from '../../scripts/verify-staged-release-mirror.js';

const digest = `sha256:${'a'.repeat(64)}`;
const metadata = createReleaseMetadata({ repository: 'cloudbyday90/Harmoniarr',
  imageName: 'ghcr.io/cloudbyday90/harmoniarr', dockerHubImageName: 'cloudbyday90/harmoniarr',
  digest, releaseTag: 'v0.1.0-beta', version: '0.1.0-beta',
  tags: ['ghcr.io/cloudbyday90/harmoniarr:0.1.0-beta', 'ghcr.io/cloudbyday90/harmoniarr:v0.1.0-beta',
    'cloudbyday90/harmoniarr:0.1.0-beta', 'cloudbyday90/harmoniarr:v0.1.0-beta'] });

test('staged mirror verification checks the build digest without requiring release aliases', async () => {
  const calls = [];
  const result = await verifyStagedReleaseMirror({ metadata, expectedDigest: digest,
    inspectRegistryImageManifestFn: async (reference) => { calls.push(reference); return { digest }; } });
  assert.deepEqual(calls, [`cloudbyday90/harmoniarr@${digest}`]);
  assert.equal(result.verifiedReferenceCount, 1);
});

test('staged mirror verification rejects an absent or mismatched expected digest before registry access', async () => {
  for (const expectedDigest of [undefined, 'sha256:short', `sha256:${'b'.repeat(64)}`]) {
    await assert.rejects(verifyStagedReleaseMirror({ metadata, expectedDigest,
      inspectRegistryImageManifestFn: async () => { assert.fail('Invalid binding must prevent registry access'); } }));
  }
});

test('staged mirror verification rejects a registry digest mismatch', async () => {
  await assert.rejects(verifyStagedReleaseMirror({ metadata, expectedDigest: digest,
    inspectRegistryImageManifestFn: async () => ({ digest: `sha256:${'b'.repeat(64)}` }) }), /resolved to/);
});
