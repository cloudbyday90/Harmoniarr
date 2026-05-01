/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { runBufferedCommand } from './process-runtime.js';
import { buildOrasRegistryAuthArgs, resolveRegistryAuth } from './registry-auth.js';
import { buildOrasCopyArgs, buildOrasDiscoverArgs } from './registry-referrers.js';

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function parseDescriptor(node, fieldName) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    throw new Error(`${fieldName} must be a JSON object`);
  }

  if (!isNonEmptyString(node.digest)) {
    throw new Error(`${fieldName}.digest must be a non-empty string`);
  }

  if (!isNonEmptyString(node.reference)) {
    throw new Error(`${fieldName}.reference must be a non-empty string`);
  }

  const referrers = Array.isArray(node.referrers) ? node.referrers : [];
  return {
    ...node,
    digest: node.digest.trim(),
    reference: node.reference.trim(),
    referrers: referrers.map((referrer, index) => parseDescriptor(referrer, `${fieldName}.referrers[${index}]`)),
  };
}

function withDistributionSpecFallback(referrersPlan) {
  if (!referrersPlan?.fallbackDistributionSpec) {
    return null;
  }

  return {
    distributionSpec: referrersPlan.fallbackDistributionSpec,
    fallbackDistributionSpec: null,
    hasFallbackDistributionSpec: false,
  };
}

export function parseOrasDiscoverOutput(text) {
  const parsed = JSON.parse(text);
  return parseDescriptor(parsed, 'discover output');
}

export function collectOrasReferrers(rootDescriptor) {
  const collected = [];

  function visit(node) {
    for (const referrer of node.referrers ?? []) {
      collected.push(referrer);
      visit(referrer);
    }
  }

  visit(rootDescriptor);
  return collected;
}

export function createOrasDescriptorIdentity(descriptor) {
  if (!descriptor || typeof descriptor !== 'object' || Array.isArray(descriptor)) {
    throw new Error('descriptor must be an object');
  }

  if (!isNonEmptyString(descriptor.digest)) {
    throw new Error('descriptor.digest must be a non-empty string');
  }

  return [
    descriptor.digest.trim(),
    isNonEmptyString(descriptor.artifactType) ? descriptor.artifactType.trim() : '',
    isNonEmptyString(descriptor.mediaType) ? descriptor.mediaType.trim() : '',
  ].join('|');
}

export async function runOrasDiscover(reference, {
  env = process.env,
  referrersPlan,
  registryBinding,
  runCommandFn = runBufferedCommand,
} = {}) {
  if (!registryBinding || typeof registryBinding !== 'object' || Array.isArray(registryBinding)) {
    throw new Error('registryBinding must be an object');
  }

  const registryAuth = resolveRegistryAuth(registryBinding, env);
  const result = await runCommandFn({
    args: [
      ...buildOrasRegistryAuthArgs({ registryAuth }),
      ...buildOrasDiscoverArgs(reference, referrersPlan ?? registryBinding.referrersPlan),
    ],
    command: 'oras',
    env,
  });

  return parseOrasDiscoverOutput(result.stdout);
}

export async function discoverRegistryReferrers(reference, {
  env = process.env,
  registryBinding,
  runOrasDiscoverFn = runOrasDiscover,
} = {}) {
  const primaryPlan = registryBinding?.referrersPlan;
  try {
    const discovery = await runOrasDiscoverFn(reference, {
      env,
      referrersPlan: primaryPlan,
      registryBinding,
    });

    return {
      discovery,
      usedDistributionSpec: primaryPlan.distributionSpec,
      usedFallback: false,
    };
  } catch (error) {
    const fallbackPlan = withDistributionSpecFallback(primaryPlan);
    if (!fallbackPlan) {
      throw error;
    }

    const discovery = await runOrasDiscoverFn(reference, {
      env,
      referrersPlan: fallbackPlan,
      registryBinding,
    });

    return {
      discovery,
      usedDistributionSpec: fallbackPlan.distributionSpec,
      usedFallback: true,
    };
  }
}

export async function copyOrasArtifactGraph({
  env = process.env,
  fromReference,
  runCommandFn = runBufferedCommand,
  sourceRegistryBinding,
  targetRegistryBinding,
  toReference,
} = {}) {
  if (!sourceRegistryBinding || typeof sourceRegistryBinding !== 'object' || Array.isArray(sourceRegistryBinding)) {
    throw new Error('sourceRegistryBinding must be an object');
  }

  if (!targetRegistryBinding || typeof targetRegistryBinding !== 'object' || Array.isArray(targetRegistryBinding)) {
    throw new Error('targetRegistryBinding must be an object');
  }

  const fromAuth = resolveRegistryAuth(sourceRegistryBinding, env);
  const toAuth = resolveRegistryAuth(targetRegistryBinding, env);

  async function executeCopy(targetReferrersPlan) {
    return runCommandFn({
      args: [
        ...buildOrasRegistryAuthArgs({ prefix: 'from', registryAuth: fromAuth }),
        ...buildOrasRegistryAuthArgs({ prefix: 'to', registryAuth: toAuth }),
        ...buildOrasCopyArgs({
          fromReference,
          sourceReferrersPlan: sourceRegistryBinding.referrersPlan,
          targetReferrersPlan,
          toReference,
        }),
      ],
      command: 'oras',
      env,
    });
  }

  try {
    await executeCopy(targetRegistryBinding.referrersPlan);
    return {
      fromReference,
      toReference,
      usedFallback: false,
      usedTargetDistributionSpec: targetRegistryBinding.referrersPlan.distributionSpec,
    };
  } catch (error) {
    const fallbackPlan = withDistributionSpecFallback(targetRegistryBinding.referrersPlan);
    if (!fallbackPlan) {
      throw error;
    }

    await executeCopy(fallbackPlan);
    return {
      fromReference,
      toReference,
      usedFallback: true,
      usedTargetDistributionSpec: fallbackPlan.distributionSpec,
    };
  }
}