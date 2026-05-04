import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  renderPublishedImageVerificationSummaryLines,
  renderReleaseContractVerificationSummaryLines,
  renderReleaseImageSummaryLines,
  writeReleaseWorkflowSummary,
} from '../../scripts/release-workflow-summary.js';

test('renderReleaseImageSummaryLines formats release assets and tags', () => {
  assert.deepEqual(renderReleaseImageSummaryLines({
    composeAssetName: 'harmoniarr-release-compose.override.yaml',
    dockerHubImageName: 'cloudbyday90/harmoniarr',
    imageRef: 'ghcr.io/cloudbyday90/harmoniarr@sha256:abc',
    metadataAssetName: 'harmoniarr-release-metadata.json',
    releaseTag: 'v0.1.0-beta',
    sbomAssetName: 'harmoniarr-release.spdx.json',
    tags: ['ghcr.io/cloudbyday90/harmoniarr:0.1.0-beta', 'cloudbyday90/harmoniarr:0.1.0-beta'],
    verificationAssetName: 'harmoniarr-release-verification.txt',
  }), [
    '## Release Image',
    '',
    '- Release tag: v0.1.0-beta',
    '- Immutable image reference: ghcr.io/cloudbyday90/harmoniarr@sha256:abc',
    '- Docker Hub mirror: cloudbyday90/harmoniarr',
    '- Tags:',
    '- ghcr.io/cloudbyday90/harmoniarr:0.1.0-beta\n- cloudbyday90/harmoniarr:0.1.0-beta',
    '- SBOM artifact: harmoniarr-release.spdx.json',
    '- Compose override: harmoniarr-release-compose.override.yaml',
    '- Verification note: harmoniarr-release-verification.txt',
    '- Release manifest: harmoniarr-release-metadata.json',
    '',
  ]);
});

test('renderPublishedImageVerificationSummaryLines formats the smoke summary', () => {
  assert.deepEqual(renderPublishedImageVerificationSummaryLines({
    imageRef: 'ghcr.io/cloudbyday90/harmoniarr@sha256:abc',
    smokeContractStatus: 'passed',
    smokeEvidenceArtifactName: 'harmoniarr-docker-smoke-released-image.json',
  }), [
    '## Published Image Verification',
    '',
    '- Verified image: ghcr.io/cloudbyday90/harmoniarr@sha256:abc',
    '- Smoke contract: fresh install bootstrap plus existing-data restart',
    '- Smoke evidence contract: passed',
    '- Smoke evidence artifact: harmoniarr-docker-smoke-released-image.json',
    '',
  ]);
});

test('renderReleaseContractVerificationSummaryLines formats the contract summary', () => {
  assert.deepEqual(renderReleaseContractVerificationSummaryLines({
    attestationVerificationStatus: 'passed',
    dockerHubMirrorStatus: 'passed',
    releaseTag: 'v0.1.0-beta',
    smokeEvidenceStatus: 'published-image artifact passed',
    trustedMirrorProbeStatus: 'passed via v1.1-referrers-api',
    trustedMirrorReferrerStatus: 'passed',
    upgradeSmokeEvidenceStatus: 'upgrade-path artifact passed',
  }), [
    '## Release Contract Verification',
    '',
    '- Release tag: v0.1.0-beta',
    '- Release manifest checked against GitHub release assets',
    '- Compose override asset checked against the immutable image reference',
    '- Archived smoke evidence verification: published-image artifact passed',
    '- Archived upgrade smoke evidence verification: upgrade-path artifact passed',
    '- Docker Hub mirror verification: passed',
    '- Docker Hub trusted mirror capability probe: passed via v1.1-referrers-api',
    '- Docker Hub trusted mirror referrer verification: passed',
    '- Image attestation verification: passed',
    '',
  ]);
});

test('writeReleaseWorkflowSummary accepts CLI overrides for release-contract summaries', async () => {
  const tempDirectory = await mkdtemp(join(tmpdir(), 'harmoniarr-release-summary-'));
  const summaryPath = join(tempDirectory, 'summary.md');

  try {
    await writeReleaseWorkflowSummary('verify-release-contract', {
      args: [
        'verify-release-contract',
        '--summary-path', summaryPath,
        '--attestation-status', 'passed',
        '--dockerhub-mirror-status', 'passed',
        '--release-tag', 'v0.1.0-beta',
        '--smoke-evidence-status', 'published-image artifact passed',
        '--trusted-mirror-probe-status', 'passed via v1.1-referrers-api',
        '--trusted-mirror-referrer-status', 'passed',
        '--upgrade-smoke-evidence-status', 'upgrade-path artifact passed',
      ],
      env: {},
    });

    const summary = await readFile(summaryPath, 'utf8');
    assert.match(summary, /Release Contract Verification/);
    assert.match(summary, /Archived smoke evidence verification: published-image artifact passed/);
    assert.match(summary, /Archived upgrade smoke evidence verification: upgrade-path artifact passed/);
  } finally {
    await rm(tempDirectory, { force: true, recursive: true });
  }
});

test('writeReleaseWorkflowSummary accepts CLI overrides for publish-image summaries', async () => {
  const tempDirectory = await mkdtemp(join(tmpdir(), 'harmoniarr-release-summary-'));
  const summaryPath = join(tempDirectory, 'summary.md');

  try {
    await writeReleaseWorkflowSummary('publish-image', {
      args: [
        'publish-image',
        '--summary-path', summaryPath,
        '--compose-asset-name', 'harmoniarr-release-compose.override.yaml',
        '--dockerhub-image-name', 'cloudbyday90/harmoniarr',
        '--image-ref', 'ghcr.io/cloudbyday90/harmoniarr@sha256:abc',
        '--metadata-asset-name', 'harmoniarr-release-metadata.json',
        '--release-tag', 'v0.1.0-beta',
        '--sbom-asset-name', 'harmoniarr-release.spdx.json',
        '--tag', 'ghcr.io/cloudbyday90/harmoniarr:0.1.0-beta',
        '--tag', 'cloudbyday90/harmoniarr:0.1.0-beta',
        '--verification-asset-name', 'harmoniarr-release-verification.txt',
      ],
      env: {},
    });

    const summary = await readFile(summaryPath, 'utf8');
    assert.match(summary, /## Release Image/);
    assert.match(summary, /Docker Hub mirror: cloudbyday90\/harmoniarr/);
    assert.match(summary, /Release manifest: harmoniarr-release-metadata.json/);
  } finally {
    await rm(tempDirectory, { force: true, recursive: true });
  }
});

test('writeReleaseWorkflowSummary accepts CLI overrides for published-image verification summaries', async () => {
  const tempDirectory = await mkdtemp(join(tmpdir(), 'harmoniarr-release-summary-'));
  const summaryPath = join(tempDirectory, 'summary.md');

  try {
    await writeReleaseWorkflowSummary('verify-published-image', {
      args: [
        'verify-published-image',
        '--summary-path', summaryPath,
        '--image-ref', 'ghcr.io/cloudbyday90/harmoniarr@sha256:abc',
        '--smoke-contract-status', 'passed',
        '--smoke-evidence-artifact-name', 'harmoniarr-docker-smoke-released-image.json',
      ],
      env: {},
    });

    const summary = await readFile(summaryPath, 'utf8');
    assert.match(summary, /Published Image Verification/);
    assert.match(summary, /Smoke evidence contract: passed/);
    assert.match(summary, /Smoke evidence artifact: harmoniarr-docker-smoke-released-image.json/);
  } finally {
    await rm(tempDirectory, { force: true, recursive: true });
  }
});