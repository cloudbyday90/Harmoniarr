/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export const mirrorTrustModes = Object.freeze({
  runtimeOnly: 'runtime_only',
  trusted: 'trusted',
});

export const registryKeys = Object.freeze({
  dockerHub: 'dockerHub',
  ghcr: 'ghcr',
});

const registryCapabilityMap = Object.freeze({
  [registryKeys.ghcr]: Object.freeze({
    attestationSource: true,
    displayName: 'GHCR',
    key: registryKeys.ghcr,
    referrersDiscovery: 'same_registry',
    role: 'canonical',
    sbomDelivery: 'release_asset',
    verification: 'attestation_and_digest',
  }),
  [registryKeys.dockerHub]: Object.freeze({
    attestationSource: false,
    displayName: 'Docker Hub',
    key: registryKeys.dockerHub,
    promotionCandidate: 'oras_copy_recursive',
    promotionVerification: 'digest_and_referrers',
    referrerPolicy: 'not_mirrored',
    referrersDiscovery: 'oci_1_1_or_referrers_tag',
    role: 'mirror',
    trustMode: 'runtime_only',
    verification: 'digest_parity',
  }),
});

export function getRegistryCapabilities(registryKey) {
  if (!isNonEmptyString(registryKey)) {
    throw new Error('registryKey is required');
  }

  const normalizedKey = registryKey.trim();
  const capabilities = registryCapabilityMap[normalizedKey];

  if (!capabilities) {
    throw new Error(`Unsupported registry key: ${normalizedKey}`);
  }

  return capabilities;
}

export function createRegistryMirrorCapabilities({
  imageName,
  registryKey,
  trustMode = mirrorTrustModes.runtimeOnly,
} = {}) {
  if (!isNonEmptyString(imageName)) {
    throw new Error('imageName is required');
  }

  if (!Object.values(mirrorTrustModes).includes(trustMode)) {
    throw new Error(`trustMode must be one of ${Object.values(mirrorTrustModes).join(', ')}`);
  }

  const capabilities = getRegistryCapabilities(registryKey);
  if (capabilities.role !== 'mirror') {
    throw new Error(`Registry ${registryKey} does not describe a mirror capability profile`);
  }

  return {
    imageName: imageName.trim(),
    promotionCandidate: capabilities.promotionCandidate,
    promotionVerification: capabilities.promotionVerification,
    referrerPolicy: trustMode === mirrorTrustModes.trusted ? 'copied' : capabilities.referrerPolicy,
    referrersDiscovery: capabilities.referrersDiscovery,
    trustMode,
    verification: trustMode === mirrorTrustModes.trusted ? capabilities.promotionVerification : capabilities.verification,
  };
}