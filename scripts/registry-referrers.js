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

export const distributionSpecModes = Object.freeze({
  referrersApi: 'v1.1-referrers-api',
  referrersTag: 'v1.1-referrers-tag',
});

const supportedDistributionSpecModes = new Set(Object.values(distributionSpecModes));

function normalizeDistributionSpecMode(mode, fieldName) {
  if (!isNonEmptyString(mode)) {
    throw new Error(`${fieldName} is required`);
  }

  const normalizedMode = mode.trim();
  if (!supportedDistributionSpecModes.has(normalizedMode)) {
    throw new Error(`${fieldName} must be one of ${[...supportedDistributionSpecModes].join(', ')}`);
  }

  return normalizedMode;
}

function getDefaultDistributionSpec(referrersDiscovery) {
  switch (referrersDiscovery) {
    case 'same_registry':
    case 'oci_1_1_or_referrers_tag':
      return distributionSpecModes.referrersApi;
    default:
      throw new Error(`Unsupported referrersDiscovery strategy: ${referrersDiscovery}`);
  }
}

function getFallbackDistributionSpec(referrersDiscovery) {
  switch (referrersDiscovery) {
    case 'same_registry':
      return null;
    case 'oci_1_1_or_referrers_tag':
      return distributionSpecModes.referrersTag;
    default:
      throw new Error(`Unsupported referrersDiscovery strategy: ${referrersDiscovery}`);
  }
}

export function resolveRegistryReferrersPlan({
  distributionSpec,
  fallbackDistributionSpec,
  registryBinding,
} = {}) {
  if (!registryBinding || typeof registryBinding !== 'object' || Array.isArray(registryBinding)) {
    throw new Error('registryBinding must be an object');
  }

  if (!isNonEmptyString(registryBinding.referrersDiscovery)) {
    throw new Error('registryBinding.referrersDiscovery is required');
  }

  const resolvedDistributionSpec = distributionSpec
    ? normalizeDistributionSpecMode(distributionSpec, 'distributionSpec')
    : getDefaultDistributionSpec(registryBinding.referrersDiscovery);
  const resolvedFallbackDistributionSpec = fallbackDistributionSpec === null
    ? null
    : fallbackDistributionSpec
      ? normalizeDistributionSpecMode(fallbackDistributionSpec, 'fallbackDistributionSpec')
      : getFallbackDistributionSpec(registryBinding.referrersDiscovery);

  if (resolvedFallbackDistributionSpec === resolvedDistributionSpec) {
    throw new Error('fallbackDistributionSpec must differ from distributionSpec when provided');
  }

  return {
    distributionSpec: resolvedDistributionSpec,
    fallbackDistributionSpec: resolvedFallbackDistributionSpec,
    hasFallbackDistributionSpec: Boolean(resolvedFallbackDistributionSpec),
  };
}

export function buildOrasDiscoverArgs(reference, referrersPlan) {
  if (!isNonEmptyString(reference)) {
    throw new Error('reference is required');
  }

  if (!referrersPlan || typeof referrersPlan !== 'object' || Array.isArray(referrersPlan)) {
    throw new Error('referrersPlan must be an object');
  }

  return [
    'discover',
    '--distribution-spec',
    normalizeDistributionSpecMode(referrersPlan.distributionSpec, 'referrersPlan.distributionSpec'),
    '--format',
    'json',
    reference.trim(),
  ];
}

export function buildOrasCopyArgs({
  fromReference,
  recursive = true,
  sourceReferrersPlan,
  targetReferrersPlan,
  toReference,
} = {}) {
  if (!isNonEmptyString(fromReference)) {
    throw new Error('fromReference is required');
  }

  if (!isNonEmptyString(toReference)) {
    throw new Error('toReference is required');
  }

  const args = ['cp'];
  if (recursive) {
    args.push('-r');
  }

  args.push(
    '--from-distribution-spec',
    normalizeDistributionSpecMode(sourceReferrersPlan?.distributionSpec, 'sourceReferrersPlan.distributionSpec'),
    '--to-distribution-spec',
    normalizeDistributionSpecMode(targetReferrersPlan?.distributionSpec, 'targetReferrersPlan.distributionSpec'),
    fromReference.trim(),
    toReference.trim(),
  );

  return args;
}