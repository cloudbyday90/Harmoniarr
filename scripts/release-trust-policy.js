/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  createRegistryMirrorCapabilities,
  getRegistryCapabilities,
  mirrorTrustModes,
  registryKeys,
} from './registry-capabilities.js';

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export const defaultMirrorTrustSettings = Object.freeze({
  runtimeOnlyRationale: 'oci_referrers_not_mirrored_automatically',
  trustedRationale: 'copied_referrers_with_oras_recursive',
});

const canonicalRegistryCapabilities = getRegistryCapabilities(registryKeys.ghcr);

export const defaultReleaseTrustSettings = Object.freeze({
  attestationSource: canonicalRegistryCapabilities.key,
  canonicalRegistry: canonicalRegistryCapabilities.key,
  referrersDiscovery: canonicalRegistryCapabilities.referrersDiscovery,
  sbomDelivery: canonicalRegistryCapabilities.sbomDelivery,
  verification: canonicalRegistryCapabilities.verification,
});

export function createReleaseTrustPolicy({
  dockerHubImageName = null,
  dockerHubTrustMode = mirrorTrustModes.runtimeOnly,
  imageName,
  immutableImageRef,
} = {}) {
  if (!isNonEmptyString(imageName)) {
    throw new Error('imageName is required');
  }

  if (!isNonEmptyString(immutableImageRef)) {
    throw new Error('immutableImageRef is required');
  }

  return {
    attestationSource: defaultReleaseTrustSettings.attestationSource,
    canonicalImageName: imageName.trim(),
    canonicalImmutableImageRef: immutableImageRef.trim(),
    canonicalRegistry: defaultReleaseTrustSettings.canonicalRegistry,
    canonicalVerification: defaultReleaseTrustSettings.verification,
    mirrors: {
      ...(isNonEmptyString(dockerHubImageName)
        ? {
            dockerHub: {
              ...createRegistryMirrorCapabilities({
                imageName: dockerHubImageName,
                registryKey: registryKeys.dockerHub,
                trustMode: dockerHubTrustMode,
              }),
              rationale: dockerHubTrustMode === mirrorTrustModes.trusted
                ? defaultMirrorTrustSettings.trustedRationale
                : defaultMirrorTrustSettings.runtimeOnlyRationale,
            },
          }
        : {}),
    },
    referrersDiscovery: defaultReleaseTrustSettings.referrersDiscovery,
    sbomDelivery: defaultReleaseTrustSettings.sbomDelivery,
  };
}