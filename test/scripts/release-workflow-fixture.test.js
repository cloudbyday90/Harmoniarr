import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { writeReleaseMetadataFiles } from '../../scripts/release-metadata.js';
import { verifyReleaseContractFromEnvironment } from '../../scripts/verify-release-contract.js';
import {
  resolveImageRegistryPlanFromEnvironment,
  writeImageRegistryPlanToGitHubOutput,
} from '../../scripts/write-image-registry-config.js';
import {
  parseGitHubEnvironmentFileFromPath,
  writeReleaseViewFixture,
} from './github-actions-fixture.js';

function createWorkflowTagOutput(imageNames, version, releaseTag) {
  return imageNames
    .flatMap((imageName) => [`${imageName}:${version}`, `${imageName}:${releaseTag}`])
    .join('\n');
}

test('release workflow fixture composes registry outputs, metadata assets, and contract verification', async () => {
  const tempDirectory = await mkdtemp(join(tmpdir(), 'harmoniarr-release-workflow-fixture-'));
  const githubOutputPath = join(tempDirectory, 'github-output.txt');
  const assetDirectory = join(tempDirectory, 'supply-chain');
  const releaseViewPath = join(tempDirectory, 'release-view.json');

  try {
    const plan = resolveImageRegistryPlanFromEnvironment({
      HARMONIARR_DOCKERHUB_NAMESPACE: 'CloudByDay90',
      HARMONIARR_DOCKERHUB_REPOSITORY: 'Harmoniarr',
      HARMONIARR_ENABLE_DOCKERHUB: 'true',
      HARMONIARR_ENABLE_TRUSTED_DOCKERHUB_MIRROR: 'true',
      HARMONIARR_RELEASE_TAG: 'v0.1.0-beta',
      HARMONIARR_REPOSITORY_NAME: 'Harmoniarr',
      HARMONIARR_REPOSITORY_OWNER: 'CloudByDay90',
    });

    await writeImageRegistryPlanToGitHubOutput(plan, githubOutputPath);
    const githubOutput = await parseGitHubEnvironmentFileFromPath(githubOutputPath);

    assert.equal(githubOutput.canonical_registry, 'ghcr');
    assert.equal(githubOutput.trusted_dockerhub_mirror_enabled, 'true');
    assert.equal(githubOutput.dockerhub_image_name, 'cloudbyday90/harmoniarr');
    assert.equal(githubOutput.release_tag, 'v0.1.0-beta');

    const { metadata, composeOverridePath, metadataPath } = await writeReleaseMetadataFiles({
      directory: assetDirectory,
      digest: 'sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      dockerHubImageName: githubOutput.dockerhub_image_name,
      dockerHubTrustMode: githubOutput.trusted_dockerhub_mirror_enabled === 'true' ? 'trusted' : 'runtime_only',
      imageName: githubOutput.image_name,
      releaseTag: githubOutput.release_tag,
      repository: 'cloudbyday90/Harmoniarr',
      tagsText: createWorkflowTagOutput(plan.publishImageNames, githubOutput.version, githubOutput.release_tag),
      version: githubOutput.version,
    });

    await writeReleaseViewFixture(releaseViewPath, metadata);

    const result = await verifyReleaseContractFromEnvironment({
      HARMONIARR_RELEASE_COMPOSE_OVERRIDE_PATH: composeOverridePath,
      HARMONIARR_RELEASE_EXPECTED_DIGEST: metadata.digest,
      HARMONIARR_RELEASE_EXPECTED_DOCKERHUB_IMAGE_NAME: githubOutput.dockerhub_image_name,
      HARMONIARR_RELEASE_EXPECTED_DOCKERHUB_TRUST_MODE: 'trusted',
      HARMONIARR_RELEASE_EXPECTED_IMAGE_NAME: githubOutput.image_name,
      HARMONIARR_RELEASE_EXPECTED_REPOSITORY: 'cloudbyday90/Harmoniarr',
      HARMONIARR_RELEASE_EXPECTED_TAG: githubOutput.release_tag,
      HARMONIARR_RELEASE_EXPECTED_VERSION: githubOutput.version,
      HARMONIARR_RELEASE_METADATA_PATH: metadataPath,
      HARMONIARR_RELEASE_VIEW_PATH: releaseViewPath,
    });

    assert.equal(result.releaseTag, 'v0.1.0-beta');
    assert.equal(result.immutableImageRef, 'ghcr.io/cloudbyday90/harmoniarr@sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef');
    assert.equal(result.assetCount, 4);
    assert.equal(metadata.trust.mirrors.dockerHub.trustMode, 'trusted');
  } finally {
    await rm(tempDirectory, { force: true, recursive: true });
  }
});