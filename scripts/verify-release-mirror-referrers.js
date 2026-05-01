/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { readFile } from 'node:fs/promises';
import {
  collectOrasReferrers,
  createOrasDescriptorIdentity,
  discoverRegistryReferrers,
} from './oras-registry.js';
import { getReleaseMirror, parseReleaseMetadata } from './release-contract.js';
import {
  imageRegistryPlanCliOptions,
  parseReleaseScriptOptions,
  releaseMirrorCliOptions,
  resolveImageRegistryPlanInputs,
  resolveReleaseMirrorInputs,
} from './release-script-inputs.js';
import { runDirectScriptTask } from './script-runtime.js';
import { resolveImageRegistryPlanFromInputs } from './write-image-registry-config.js';

function createDescriptorIdentitySet(rootDescriptor) {
  return new Set(collectOrasReferrers(rootDescriptor).map(createOrasDescriptorIdentity));
}

export function verifyDiscoveredReferrerGraphs({
  expectedDigest,
  sourceDiscovery,
  targetDiscovery,
} = {}) {
  if (!expectedDigest?.trim()) {
    throw new Error('expectedDigest is required');
  }

  if (sourceDiscovery?.digest !== expectedDigest) {
    throw new Error(`Source discovery resolved to ${sourceDiscovery?.digest ?? '<missing>'} instead of ${expectedDigest}`);
  }

  if (targetDiscovery?.digest !== expectedDigest) {
    throw new Error(`Target discovery resolved to ${targetDiscovery?.digest ?? '<missing>'} instead of ${expectedDigest}`);
  }

  const sourceKeys = createDescriptorIdentitySet(sourceDiscovery);
  const targetKeys = createDescriptorIdentitySet(targetDiscovery);

  const missingKeys = [...sourceKeys].filter((key) => !targetKeys.has(key));
  const unexpectedKeys = [...targetKeys].filter((key) => !sourceKeys.has(key));

  if (missingKeys.length > 0 || unexpectedKeys.length > 0) {
    throw new Error([
      'Trusted mirror referrer verification failed.',
      missingKeys.length > 0 ? `Missing referrers: ${missingKeys.join(', ')}` : null,
      unexpectedKeys.length > 0 ? `Unexpected referrers: ${unexpectedKeys.join(', ')}` : null,
    ].filter(Boolean).join(' '));
  }

  return {
    expectedDigest,
    referrerCount: sourceKeys.size,
  };
}

export async function verifyReleaseMirrorReferrers({
  discoverRegistryReferrersFn = discoverRegistryReferrers,
  env = process.env,
  expectedDigest,
  metadata,
  mirrorName = 'dockerHub',
  plan,
} = {}) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new Error('metadata must be an object');
  }

  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
    throw new Error('plan must be an object');
  }

  const mirror = getReleaseMirror(metadata, mirrorName);
  const sourceRegistryBinding = plan.registries?.[plan.canonicalRegistry];
  const targetRegistryBinding = plan.registries?.[mirrorName];

  const sourceResult = await discoverRegistryReferrersFn(metadata.immutableImageRef, {
    env,
    registryBinding: sourceRegistryBinding,
  });
  const targetResult = await discoverRegistryReferrersFn(mirror.immutableImageRef, {
    env,
    registryBinding: targetRegistryBinding,
  });

  const verification = verifyDiscoveredReferrerGraphs({
    expectedDigest,
    sourceDiscovery: sourceResult.discovery,
    targetDiscovery: targetResult.discovery,
  });

  return {
    ...verification,
    usedTargetDistributionSpec: targetResult.usedDistributionSpec,
    usedTargetFallback: targetResult.usedFallback,
  };
}

export async function verifyReleaseMirrorReferrersFromEnvironment(env = process.env, { args = process.argv.slice(2) } = {}) {
  const { values } = parseReleaseScriptOptions({
    ...imageRegistryPlanCliOptions,
    ...releaseMirrorCliOptions,
  }, { args });
  const { expectedDigest, metadataPath, mirrorName } = resolveReleaseMirrorInputs({ env, values });
  const metadataText = await readFile(metadataPath, 'utf8');
  const metadata = parseReleaseMetadata(metadataText);

  return verifyReleaseMirrorReferrers({
    env,
    expectedDigest: expectedDigest ?? metadata.digest,
    metadata,
    mirrorName,
    plan: resolveImageRegistryPlanFromInputs(resolveImageRegistryPlanInputs({ env, values })),
  });
}

await runDirectScriptTask(import.meta, {
    prefix: 'harmoniarr-verify-release-mirror-referrers',
    renderSuccessMessage: ({ referrerCount, usedTargetDistributionSpec, usedTargetFallback }) => {
      const fallbackSummary = usedTargetFallback ? ' with fallback distribution spec' : '';
      return `Verified ${referrerCount} trusted mirror referrer${referrerCount === 1 ? '' : 's'} using ${usedTargetDistributionSpec}${fallbackSummary}`;
    },
    run: () => verifyReleaseMirrorReferrersFromEnvironment(),
  });