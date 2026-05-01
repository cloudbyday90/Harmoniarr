/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  getBooleanInput,
  getOptionalStringInput,
  getRequiredStringInput,
  normalizeOptionalString,
  parseStrictScriptOptions,
} from './script-input-resolution.js';

export const imageRegistryPlanCliOptions = Object.freeze({
  'dockerhub-namespace': { type: 'string' },
  'dockerhub-repository': { type: 'string' },
  'enable-dockerhub': { type: 'boolean' },
  'enable-trusted-dockerhub-mirror': { type: 'boolean' },
  'release-tag': { type: 'string' },
  'repository-name': { type: 'string' },
  'repository-owner': { type: 'string' },
});

export const releaseMirrorCliOptions = Object.freeze({
  'expected-digest': { type: 'string' },
  'metadata-path': { type: 'string' },
  'mirror-key': { type: 'string' },
});

export const releaseContractCliOptions = Object.freeze({
  'compose-override-path': { type: 'string' },
  'expected-digest': { type: 'string' },
  'expected-dockerhub-image-name': { type: 'string' },
  'expected-dockerhub-trust-mode': { type: 'string' },
  'expected-image-name': { type: 'string' },
  'expected-release-tag': { type: 'string' },
  'expected-repository': { type: 'string' },
  'expected-version': { type: 'string' },
  'metadata-path': { type: 'string' },
  'release-view-path': { type: 'string' },
});

export const writeReleaseMetadataCliOptions = Object.freeze({
  'asset-dir': { type: 'string' },
  digest: { type: 'string' },
  'dockerhub-image-name': { type: 'string' },
  'dockerhub-trust-mode': { type: 'string' },
  'image-name': { type: 'string' },
  repository: { type: 'string' },
  'release-tag': { type: 'string' },
  tags: { type: 'string' },
  version: { type: 'string' },
});

export function parseReleaseScriptOptions(options, { args = process.argv.slice(2) } = {}) {
  return parseStrictScriptOptions(options, { args });
}

export function resolveImageRegistryPlanInputs({
  args = process.argv.slice(2),
  env = process.env,
  values,
} = {}) {
  const resolvedValues = values ?? parseReleaseScriptOptions(imageRegistryPlanCliOptions, { args }).values;

  return {
    dockerHubNamespace: getOptionalStringInput(resolvedValues, 'dockerhub-namespace', 'HARMONIARR_DOCKERHUB_NAMESPACE', env),
    dockerHubRepository: getOptionalStringInput(resolvedValues, 'dockerhub-repository', 'HARMONIARR_DOCKERHUB_REPOSITORY', env),
    enableDockerHub: getBooleanInput(resolvedValues, 'enable-dockerhub', 'HARMONIARR_ENABLE_DOCKERHUB', env, false),
    enableTrustedDockerHubMirror: getBooleanInput(
      resolvedValues,
      'enable-trusted-dockerhub-mirror',
      'HARMONIARR_ENABLE_TRUSTED_DOCKERHUB_MIRROR',
      env,
      false,
    ),
    releaseTag: getOptionalStringInput(resolvedValues, 'release-tag', 'HARMONIARR_RELEASE_TAG', env),
    repositoryName: getRequiredStringInput(resolvedValues, 'repository-name', 'HARMONIARR_REPOSITORY_NAME', env),
    repositoryOwner: getRequiredStringInput(resolvedValues, 'repository-owner', 'HARMONIARR_REPOSITORY_OWNER', env),
  };
}

export function resolveReleaseMirrorInputs({
  args = process.argv.slice(2),
  env = process.env,
  values,
} = {}) {
  const resolvedValues = values ?? parseReleaseScriptOptions(releaseMirrorCliOptions, { args }).values;

  return {
    expectedDigest: getOptionalStringInput(resolvedValues, 'expected-digest', 'HARMONIARR_RELEASE_EXPECTED_DIGEST', env),
    metadataPath: getRequiredStringInput(resolvedValues, 'metadata-path', 'HARMONIARR_RELEASE_METADATA_PATH', env),
    mirrorName: getOptionalStringInput(resolvedValues, 'mirror-key', 'HARMONIARR_RELEASE_MIRROR_KEY', env) ?? 'dockerHub',
  };
}

export function resolveReleaseContractInputs({
  args = process.argv.slice(2),
  env = process.env,
  values,
} = {}) {
  const resolvedValues = values ?? parseReleaseScriptOptions(releaseContractCliOptions, { args }).values;

  return {
    composeOverridePath: getOptionalStringInput(resolvedValues, 'compose-override-path', 'HARMONIARR_RELEASE_COMPOSE_OVERRIDE_PATH', env),
    expectedDigest: getOptionalStringInput(resolvedValues, 'expected-digest', 'HARMONIARR_RELEASE_EXPECTED_DIGEST', env),
    expectedDockerHubImageName: getOptionalStringInput(
      resolvedValues,
      'expected-dockerhub-image-name',
      'HARMONIARR_RELEASE_EXPECTED_DOCKERHUB_IMAGE_NAME',
      env,
    ),
    expectedDockerHubTrustMode: getOptionalStringInput(
      resolvedValues,
      'expected-dockerhub-trust-mode',
      'HARMONIARR_RELEASE_EXPECTED_DOCKERHUB_TRUST_MODE',
      env,
    ),
    expectedImageName: getOptionalStringInput(resolvedValues, 'expected-image-name', 'HARMONIARR_RELEASE_EXPECTED_IMAGE_NAME', env),
    expectedReleaseTag: getOptionalStringInput(resolvedValues, 'expected-release-tag', 'HARMONIARR_RELEASE_EXPECTED_TAG', env),
    expectedRepository: getOptionalStringInput(resolvedValues, 'expected-repository', 'HARMONIARR_RELEASE_EXPECTED_REPOSITORY', env),
    expectedVersion: getOptionalStringInput(resolvedValues, 'expected-version', 'HARMONIARR_RELEASE_EXPECTED_VERSION', env),
    metadataPath: getRequiredStringInput(resolvedValues, 'metadata-path', 'HARMONIARR_RELEASE_METADATA_PATH', env),
    releaseViewPath: getOptionalStringInput(resolvedValues, 'release-view-path', 'HARMONIARR_RELEASE_VIEW_PATH', env),
  };
}

export function resolveWriteReleaseMetadataInputs({
  args = process.argv.slice(2),
  env = process.env,
  values,
} = {}) {
  const resolvedValues = values ?? parseReleaseScriptOptions(writeReleaseMetadataCliOptions, { args }).values;

  return {
    directory: getOptionalStringInput(resolvedValues, 'asset-dir', 'HARMONIARR_RELEASE_ASSET_DIR', env) ?? 'supply-chain',
    digest: getRequiredStringInput(resolvedValues, 'digest', 'HARMONIARR_RELEASE_DIGEST', env),
    dockerHubImageName: getOptionalStringInput(resolvedValues, 'dockerhub-image-name', 'HARMONIARR_RELEASE_DOCKERHUB_IMAGE_NAME', env),
    dockerHubTrustMode: getOptionalStringInput(resolvedValues, 'dockerhub-trust-mode', 'HARMONIARR_RELEASE_DOCKERHUB_TRUST_MODE', env) ?? undefined,
    imageName: getRequiredStringInput(resolvedValues, 'image-name', 'HARMONIARR_RELEASE_IMAGE_NAME', env),
    releaseTag: getRequiredStringInput(resolvedValues, 'release-tag', 'HARMONIARR_RELEASE_TAG', env),
    repository: getRequiredStringInput(resolvedValues, 'repository', 'GITHUB_REPOSITORY', env),
    tagsText: normalizeOptionalString(resolvedValues?.tags) ?? normalizeOptionalString(env?.HARMONIARR_RELEASE_TAGS) ?? '',
    version: getRequiredStringInput(resolvedValues, 'version', 'HARMONIARR_RELEASE_VERSION', env),
  };
}