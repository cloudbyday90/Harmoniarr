/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { appendGitHubStepSummary, createMarkdownBulletList } from './github-actions-summary.js';
import { getRequiredPositionalArgument } from './script-arguments.js';
import { runDirectScriptTask } from './script-runtime.js';
import { resolveReleaseWorkflowSummaryInputs } from './workflow-summary-inputs.js';

const releaseSummaryKinds = Object.freeze({
  publishImage: 'publish-image',
  verifyPublishedImage: 'verify-published-image',
  verifyReleaseContract: 'verify-release-contract',
});

export function renderReleaseImageSummaryLines({
  composeAssetName,
  dockerHubImageName = null,
  imageRef,
  metadataAssetName,
  releaseTag,
  sbomAssetName,
  tags = [],
  verificationAssetName,
} = {}) {
  return [
    '## Release Image',
    '',
    `- Release tag: ${releaseTag}`,
    `- Immutable image reference: ${imageRef}`,
    ...(dockerHubImageName ? [`- Docker Hub mirror: ${dockerHubImageName}`] : []),
    '- Tags:',
    createMarkdownBulletList(tags),
    `- SBOM artifact: ${sbomAssetName}`,
    `- Compose override: ${composeAssetName}`,
    `- Verification note: ${verificationAssetName}`,
    `- Release manifest: ${metadataAssetName}`,
    '',
  ];
}

export function renderPublishedImageVerificationSummaryLines({
  imageRef,
  smokeEvidenceArtifactName = null,
} = {}) {
  return [
    '## Published Image Verification',
    '',
    `- Verified image: ${imageRef}`,
    '- Smoke contract: fresh install bootstrap plus existing-data restart',
    ...(smokeEvidenceArtifactName ? [`- Smoke evidence artifact: ${smokeEvidenceArtifactName}`] : []),
    '',
  ];
}

export function renderReleaseContractVerificationSummaryLines({
  attestationVerificationStatus,
  dockerHubMirrorStatus,
  releaseTag,
  trustedMirrorProbeStatus,
  trustedMirrorReferrerStatus,
} = {}) {
  return [
    '## Release Contract Verification',
    '',
    `- Release tag: ${releaseTag}`,
    '- Release manifest checked against GitHub release assets',
    '- Compose override asset checked against the immutable image reference',
    `- Docker Hub mirror verification: ${dockerHubMirrorStatus}`,
    `- Docker Hub trusted mirror capability probe: ${trustedMirrorProbeStatus}`,
    `- Docker Hub trusted mirror referrer verification: ${trustedMirrorReferrerStatus}`,
    `- Image attestation verification: ${attestationVerificationStatus}`,
    '',
  ];
}

export async function writeReleaseWorkflowSummary(summaryKind, {
  args = process.argv.slice(2),
  env = process.env,
} = {}) {
  const inputs = resolveReleaseWorkflowSummaryInputs(summaryKind, { args, env });

  switch (summaryKind) {
    case releaseSummaryKinds.publishImage:
      return appendGitHubStepSummary(inputs.summaryPath, renderReleaseImageSummaryLines(inputs));
    case releaseSummaryKinds.verifyPublishedImage:
      return appendGitHubStepSummary(inputs.summaryPath, renderPublishedImageVerificationSummaryLines(inputs));
    case releaseSummaryKinds.verifyReleaseContract:
      return appendGitHubStepSummary(inputs.summaryPath, renderReleaseContractVerificationSummaryLines(inputs));
    default:
      throw new Error(`Unsupported release summary kind: ${summaryKind}`);
  }
}

function getSummaryKind() {
  return getRequiredPositionalArgument('release workflow summary kind');
}

await runDirectScriptTask(import.meta, {
  prefix: 'harmoniarr-release-workflow-summary',
  renderSuccessMessage: () => `Workflow summary written for ${getSummaryKind()}`,
  run: () => writeReleaseWorkflowSummary(getSummaryKind()),
  stdoutStyle: 'raw',
});