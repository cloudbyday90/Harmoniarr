import assert from 'node:assert/strict';
import test from 'node:test';

import {
  inspectRegistryImageManifest,
  parseManifestInspectOutput,
  verifyRegistryImageReferences,
} from '../../scripts/verify-release-mirror.js';

test('parseManifestInspectOutput requires a digest field', () => {
  assert.equal(
    parseManifestInspectOutput('{"digest":"sha256:abc","mediaType":"application/vnd.oci.image.index.v1+json"}').digest,
    'sha256:abc',
  );
  assert.throws(() => parseManifestInspectOutput('{"mediaType":"application/vnd.oci.image.index.v1+json"}'), /must include a non-empty digest/);
});

test('inspectRegistryImageManifest requests the manifest JSON through docker buildx imagetools inspect', async () => {
  const calls = [];
  const manifest = await inspectRegistryImageManifest('cloudbyday90/harmoniarr:v0.1.0-beta', {
    runCommandFn: async (options) => {
      calls.push(options);
      return {
        stdout: '{"digest":"sha256:mirror","mediaType":"application/vnd.oci.image.index.v1+json"}',
      };
    },
  });

  assert.equal(manifest.digest, 'sha256:mirror');
  assert.deepEqual(calls, [{
    args: ['buildx', 'imagetools', 'inspect', '--format', '{{json .Manifest}}', 'cloudbyday90/harmoniarr:v0.1.0-beta'],
    command: 'docker',
  }]);
});

test('verifyRegistryImageReferences rejects mismatched mirror digests', async () => {
  await assert.rejects(
    () => verifyRegistryImageReferences({
      expectedDigest: 'sha256:expected',
      inspectRegistryImageManifestFn: async () => ({ digest: 'sha256:actual' }),
      references: ['cloudbyday90/harmoniarr:v0.1.0-beta'],
    }),
    /resolved to sha256:actual instead of sha256:expected/,
  );
});

test('verifyRegistryImageReferences accepts matching mirror digests', async () => {
  const result = await verifyRegistryImageReferences({
    expectedDigest: 'sha256:expected',
    inspectRegistryImageManifestFn: async () => ({ digest: 'sha256:expected' }),
    references: [
      'cloudbyday90/harmoniarr:v0.1.0-beta',
      'cloudbyday90/harmoniarr:0.1.0-beta',
    ],
  });

  assert.equal(result.verifiedReferenceCount, 2);
});