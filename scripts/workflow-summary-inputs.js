/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  getOptionalStringInput,
  getRequiredStringInput,
  getRequiredStringListInput,
  parseStrictScriptOptions,
} from './script-input-resolution.js';

export const releaseWorkflowSummaryCliOptions = Object.freeze({
  'attestation-status': { type: 'string' },
  'compose-asset-name': { type: 'string' },
  'dockerhub-image-name': { type: 'string' },
  'dockerhub-mirror-status': { type: 'string' },
  'image-ref': { type: 'string' },
  'metadata-asset-name': { type: 'string' },
  'release-tag': { type: 'string' },
  'sbom-asset-name': { type: 'string' },
  'smoke-evidence-artifact-name': { type: 'string' },
  'smoke-contract-status': { type: 'string' },
  'summary-path': { type: 'string' },
  tag: { multiple: true, type: 'string' },
  'trusted-mirror-probe-status': { type: 'string' },
  'trusted-mirror-referrer-status': { type: 'string' },
  'verification-asset-name': { type: 'string' },
});

export const containerMaintenanceSummaryCliOptions = Object.freeze({
  'keep-count': { type: 'string' },
  'package-name': { type: 'string' },
  'summary-path': { type: 'string' },
});

export function parseWorkflowSummaryOptions(options, { args = process.argv.slice(2) } = {}) {
  return parseStrictScriptOptions(options, {
    allowPositionals: true,
    args,
  });
}

export function resolveReleaseWorkflowSummaryInputs(summaryKind, {
  args = process.argv.slice(2),
  env = process.env,
  values,
} = {}) {
  const resolvedValues = values ?? parseWorkflowSummaryOptions(releaseWorkflowSummaryCliOptions, { args }).values;
  const summaryPath = getRequiredStringInput(resolvedValues, 'summary-path', 'GITHUB_STEP_SUMMARY', env);

  switch (summaryKind) {
    case 'publish-image':
      return {
        composeAssetName: getRequiredStringInput(resolvedValues, 'compose-asset-name', 'HARMONIARR_SUMMARY_COMPOSE_ASSET_NAME', env),
        dockerHubImageName: getOptionalStringInput(resolvedValues, 'dockerhub-image-name', 'HARMONIARR_SUMMARY_DOCKERHUB_IMAGE_NAME', env),
        imageRef: getRequiredStringInput(resolvedValues, 'image-ref', 'HARMONIARR_SUMMARY_IMAGE_REF', env),
        metadataAssetName: getRequiredStringInput(resolvedValues, 'metadata-asset-name', 'HARMONIARR_SUMMARY_METADATA_ASSET_NAME', env),
        releaseTag: getRequiredStringInput(resolvedValues, 'release-tag', 'HARMONIARR_SUMMARY_RELEASE_TAG', env),
        sbomAssetName: getRequiredStringInput(resolvedValues, 'sbom-asset-name', 'HARMONIARR_SUMMARY_SBOM_ASSET_NAME', env),
        summaryPath,
        tags: getRequiredStringListInput({
          env,
          envName: 'HARMONIARR_SUMMARY_TAGS',
          optionName: 'tag',
          separator: /\r?\n/,
          values: resolvedValues,
        }),
        verificationAssetName: getRequiredStringInput(resolvedValues, 'verification-asset-name', 'HARMONIARR_SUMMARY_VERIFICATION_ASSET_NAME', env),
      };
    case 'verify-published-image':
      return {
        imageRef: getRequiredStringInput(resolvedValues, 'image-ref', 'HARMONIARR_SUMMARY_IMAGE_REF', env),
        smokeContractStatus: getOptionalStringInput(resolvedValues, 'smoke-contract-status', 'HARMONIARR_SUMMARY_SMOKE_CONTRACT_STATUS', env),
        smokeEvidenceArtifactName: getOptionalStringInput(resolvedValues, 'smoke-evidence-artifact-name', 'HARMONIARR_SUMMARY_SMOKE_EVIDENCE_ARTIFACT_NAME', env),
        summaryPath,
      };
    case 'verify-release-contract':
      return {
        attestationVerificationStatus: getRequiredStringInput(resolvedValues, 'attestation-status', 'HARMONIARR_SUMMARY_ATTESTATION_STATUS', env),
        dockerHubMirrorStatus: getRequiredStringInput(resolvedValues, 'dockerhub-mirror-status', 'HARMONIARR_SUMMARY_DOCKERHUB_MIRROR_STATUS', env),
        releaseTag: getRequiredStringInput(resolvedValues, 'release-tag', 'HARMONIARR_SUMMARY_RELEASE_TAG', env),
        summaryPath,
        trustedMirrorProbeStatus: getRequiredStringInput(resolvedValues, 'trusted-mirror-probe-status', 'HARMONIARR_SUMMARY_TRUSTED_MIRROR_PROBE_STATUS', env),
        trustedMirrorReferrerStatus: getRequiredStringInput(resolvedValues, 'trusted-mirror-referrer-status', 'HARMONIARR_SUMMARY_TRUSTED_MIRROR_REFERRER_STATUS', env),
      };
    default:
      throw new Error(`Unsupported release summary kind: ${summaryKind}`);
  }
}

export function resolveContainerMaintenanceSummaryInputs(summaryKind, {
  args = process.argv.slice(2),
  env = process.env,
  values,
} = {}) {
  const resolvedValues = values ?? parseWorkflowSummaryOptions(containerMaintenanceSummaryCliOptions, { args }).values;
  const summaryPath = getRequiredStringInput(resolvedValues, 'summary-path', 'GITHUB_STEP_SUMMARY', env);

  switch (summaryKind) {
    case 'ghcr-preview':
    case 'ghcr-active':
      return {
        keepCount: getRequiredStringInput(resolvedValues, 'keep-count', 'HARMONIARR_SUMMARY_KEEP_COUNT', env),
        packageName: getRequiredStringInput(resolvedValues, 'package-name', 'HARMONIARR_SUMMARY_PACKAGE_NAME', env),
        summaryPath,
      };
    case 'dockerhub-skip':
      return { summaryPath };
    default:
      throw new Error(`Unsupported container maintenance summary kind: ${summaryKind}`);
  }
}