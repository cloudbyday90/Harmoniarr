import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  probeReleaseMirrorCapabilities,
  writeReleaseMirrorCapabilityProbeToGitHubOutput,
} from '../../scripts/probe-release-mirror-capabilities.js';

const metadata = {
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

const plan = {
  canonicalRegistry: 'ghcr',
  registries: {
    dockerHub: { key: 'dockerHub' },
    ghcr: { key: 'ghcr' },
  },
};

test('probeReleaseMirrorCapabilities records the working discovery modes', async () => {
  const result = await probeReleaseMirrorCapabilities({
    discoverRegistryReferrersFn: async (_reference, options) => {
      if (options.registryBinding.key === 'ghcr') {
        return {
          discovery: {
            digest: 'sha256:root',
            referrers: [{ digest: 'sha256:sbom', reference: 'ghcr@sha256:sbom', mediaType: 'application/vnd.oci.image.manifest.v1+json', referrers: [] }],
          },
          usedDistributionSpec: 'v1.1-referrers-api',
          usedFallback: false,
        };
      }

      return {
        discovery: {
          digest: 'sha256:root',
          referrers: [],
        },
        usedDistributionSpec: 'v1.1-referrers-tag',
        usedFallback: true,
      };
    },
    metadata,
    plan,
  });

  assert.deepEqual(result, {
    expectedDigest: 'sha256:root',
    mirrorName: 'dockerHub',
    sourceDistributionSpec: 'v1.1-referrers-api',
    sourceReferrerCount: 1,
    sourceUsedFallback: false,
    targetDistributionSpec: 'v1.1-referrers-tag',
    targetReferrerCount: 0,
    targetUsedFallback: true,
  });
});

test('writeReleaseMirrorCapabilityProbeToGitHubOutput emits probe fields', async () => {
  const tempDirectory = await mkdtemp(join(tmpdir(), 'harmoniarr-probe-release-mirror-'));
  const outputPath = join(tempDirectory, 'github-output.txt');

  try {
    await writeReleaseMirrorCapabilityProbeToGitHubOutput({
      expectedDigest: 'sha256:root',
      mirrorName: 'dockerHub',
      sourceDistributionSpec: 'v1.1-referrers-api',
      sourceReferrerCount: 1,
      sourceUsedFallback: false,
      targetDistributionSpec: 'v1.1-referrers-tag',
      targetReferrerCount: 0,
      targetUsedFallback: true,
    }, outputPath);

    const output = await readFile(outputPath, 'utf8');
    assert.match(output, /^mirror_name=dockerHub$/m);
    assert.match(output, /^target_distribution_spec=v1\.1-referrers-tag$/m);
    assert.match(output, /^target_used_fallback=true$/m);
  } finally {
    await rm(tempDirectory, { force: true, recursive: true });
  }
});