/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { getRegistryCapabilities, registryKeys } from './registry-capabilities.js';
import { resolveRegistryReferrersPlan } from './registry-referrers.js';

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeRequiredSegment(value, fieldName) {
  if (!isNonEmptyString(value)) {
    throw new Error(`${fieldName} is required`);
  }

  return value.trim().toLowerCase();
}

function normalizeOptionalSegment(value) {
  return isNonEmptyString(value) ? value.trim().toLowerCase() : null;
}

function createRegistryBinding({
  auth,
  enabled = true,
  imageName,
  namespace = null,
  registryKey,
  repository = null,
} = {}) {
  if (!isNonEmptyString(imageName)) {
    throw new Error('imageName is required');
  }

  const capabilities = getRegistryCapabilities(registryKey);

  return {
    ...capabilities,
    auth,
    enabled: Boolean(enabled),
    imageName: imageName.trim(),
    isCanonical: capabilities.role === 'canonical',
    namespace,
    repository,
    referrersPlan: resolveRegistryReferrersPlan({
      registryBinding: capabilities,
    }),
  };
}

function createRegistryBindings({
  dockerHubEnabled,
  dockerHubImageName,
  dockerHubNamespace,
  dockerHubRepository,
  ghcrImageName,
  ghcrPackageName,
} = {}) {
  const ghcrBinding = createRegistryBinding({
    auth: {
      required: false,
      tokenEnvName: 'GITHUB_TOKEN',
      usernameEnvName: 'GITHUB_ACTOR',
    },
    imageName: ghcrImageName,
    namespace: 'ghcr.io',
    registryKey: registryKeys.ghcr,
    repository: ghcrPackageName,
  });

  return {
    ...(dockerHubEnabled
      ? {
          dockerHub: createRegistryBinding({
            auth: {
              required: true,
              tokenEnvName: 'DOCKERHUB_TOKEN',
              usernameEnvName: 'DOCKERHUB_USERNAME',
            },
            imageName: dockerHubImageName,
            namespace: dockerHubNamespace,
            registryKey: registryKeys.dockerHub,
            repository: dockerHubRepository,
          }),
        }
      : {}),
    ghcr: ghcrBinding,
  };
}

export function listEnabledRegistryBindings(plan) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
    throw new Error('plan must be an object');
  }

  const bindings = Object.values(plan.registries ?? {});
  return bindings
    .filter((binding) => binding?.enabled)
    .sort((left, right) => Number(right?.isCanonical) - Number(left?.isCanonical));
}

export function resolveImageRegistries({
  dockerHubRepository,
  dockerHubNamespace,
  enableDockerHub = true,
  enableTrustedDockerHubMirror = false,
  repositoryName,
  repositoryOwner,
} = {}) {
  const normalizedOwner = normalizeRequiredSegment(repositoryOwner, 'repositoryOwner');
  const normalizedRepository = normalizeRequiredSegment(repositoryName, 'repositoryName');
  const ghcrImageName = `ghcr.io/${normalizedOwner}/${normalizedRepository}`;

  const normalizedDockerHubNamespace = normalizeOptionalSegment(dockerHubNamespace) || normalizedOwner;
  const normalizedDockerHubRepository = normalizeOptionalSegment(dockerHubRepository) || normalizedRepository;
  const dockerHubEnabled = Boolean(enableDockerHub);
  const trustedDockerHubMirrorEnabled = dockerHubEnabled && Boolean(enableTrustedDockerHubMirror);
  const dockerHubImageName = dockerHubEnabled
    ? `${normalizedDockerHubNamespace}/${normalizedDockerHubRepository}`
    : null;

  const publishImageNames = [ghcrImageName];
  if (dockerHubImageName) {
    publishImageNames.push(dockerHubImageName);
  }

  const registries = createRegistryBindings({
    dockerHubEnabled,
    dockerHubImageName,
    dockerHubNamespace: dockerHubEnabled ? normalizedDockerHubNamespace : null,
    dockerHubRepository: dockerHubEnabled ? normalizedDockerHubRepository : null,
    ghcrImageName,
    ghcrPackageName: normalizedRepository,
  });
  const enabledRegistryBindings = listEnabledRegistryBindings({ registries });

  return {
    canonicalRegistry: registryKeys.ghcr,
    dockerHubEnabled,
    dockerHubImageName,
    dockerHubNamespace: dockerHubEnabled ? normalizedDockerHubNamespace : null,
    dockerHubRepository: dockerHubEnabled ? normalizedDockerHubRepository : null,
    dockerMetadataImages: publishImageNames.join('\n'),
    enabledRegistryKeys: enabledRegistryBindings.map((binding) => binding.key),
    ghcrImageName,
    ghcrPackageName: normalizedRepository,
    imageName: ghcrImageName,
    mirrorRegistryKeys: dockerHubEnabled ? [registryKeys.dockerHub] : [],
    primaryImageName: ghcrImageName,
    publishImageNames,
    registries,
    trustedDockerHubMirrorEnabled,
  };
}

export function resolveReleaseImagePlan({
  releaseTag,
  ...registryOptions
} = {}) {
  if (!isNonEmptyString(releaseTag)) {
    throw new Error('releaseTag is required');
  }

  const normalizedReleaseTag = releaseTag.trim();
  const version = normalizedReleaseTag.startsWith('v')
    ? normalizedReleaseTag.slice(1)
    : normalizedReleaseTag;

  return {
    ...resolveImageRegistries(registryOptions),
    isPrerelease: version.includes('-'),
    releaseTag: normalizedReleaseTag,
    version,
  };
}