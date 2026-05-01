/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { readFile } from 'node:fs/promises';
import { appendGitHubOutputEntries } from './github-actions-output.js';
import { collectOrasReferrers, discoverRegistryReferrers } from './oras-registry.js';
import { getReleaseMirror, parseReleaseMetadata } from './release-contract.js';
import {
  imageRegistryPlanCliOptions,
  parseReleaseScriptOptions,
  releaseMirrorCliOptions,
  resolveImageRegistryPlanInputs,
  resolveReleaseMirrorInputs,
} from './release-script-inputs.js';
import { getOptionalEnv } from './script-environment.js';
import { runDirectScriptTask } from './script-runtime.js';
import { resolveImageRegistryPlanFromInputs } from './write-image-registry-config.js';

function countReferrers(discovery) {
  return collectOrasReferrers(discovery).length;
}

export async function probeReleaseMirrorCapabilities({
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

  const resolvedExpectedDigest = expectedDigest?.trim() || metadata.digest;
  if (sourceResult.discovery.digest !== resolvedExpectedDigest) {
    throw new Error(`Canonical registry probe resolved ${sourceResult.discovery.digest} instead of ${resolvedExpectedDigest}`);
  }

  if (targetResult.discovery.digest !== resolvedExpectedDigest) {
    throw new Error(`Mirror registry probe resolved ${targetResult.discovery.digest} instead of ${resolvedExpectedDigest}`);
  }

  return {
    expectedDigest: resolvedExpectedDigest,
    mirrorName,
    sourceDistributionSpec: sourceResult.usedDistributionSpec,
    sourceReferrerCount: countReferrers(sourceResult.discovery),
    sourceUsedFallback: sourceResult.usedFallback,
    targetDistributionSpec: targetResult.usedDistributionSpec,
    targetReferrerCount: countReferrers(targetResult.discovery),
    targetUsedFallback: targetResult.usedFallback,
  };
}

export async function writeReleaseMirrorCapabilityProbeToGitHubOutput(result, outputPath) {
  if (!outputPath) {
    return;
  }

  await appendGitHubOutputEntries(outputPath, [
    { name: 'mirror_name', value: result.mirrorName },
    { name: 'probe_expected_digest', value: result.expectedDigest },
    { name: 'source_distribution_spec', value: result.sourceDistributionSpec },
    { name: 'source_referrer_count', value: result.sourceReferrerCount },
    { name: 'source_used_fallback', value: result.sourceUsedFallback },
    { name: 'target_distribution_spec', value: result.targetDistributionSpec },
    { name: 'target_referrer_count', value: result.targetReferrerCount },
    { name: 'target_used_fallback', value: result.targetUsedFallback },
  ]);
}

export async function probeReleaseMirrorCapabilitiesFromEnvironment(env = process.env, { args = process.argv.slice(2) } = {}) {
  const { values } = parseReleaseScriptOptions({
    ...imageRegistryPlanCliOptions,
    ...releaseMirrorCliOptions,
  }, { args });
  const { expectedDigest, metadataPath, mirrorName } = resolveReleaseMirrorInputs({ env, values });
  const metadataText = await readFile(metadataPath, 'utf8');
  const result = await probeReleaseMirrorCapabilities({
    env,
    expectedDigest,
    metadata: parseReleaseMetadata(metadataText),
    mirrorName,
    plan: resolveImageRegistryPlanFromInputs(resolveImageRegistryPlanInputs({ env, values })),
  });

  await writeReleaseMirrorCapabilityProbeToGitHubOutput(result, getOptionalEnv('GITHUB_OUTPUT', env));
  return result;
}

await runDirectScriptTask(import.meta, {
    prefix: 'harmoniarr-probe-release-mirror-capabilities',
    renderSuccessMessage: ({ targetDistributionSpec, targetReferrerCount, targetUsedFallback }) => {
      const fallbackSummary = targetUsedFallback ? ' with fallback distribution spec' : '';
      return `Probed trusted mirror capability via ${targetDistributionSpec}${fallbackSummary}; target currently exposes ${targetReferrerCount} referrer${targetReferrerCount === 1 ? '' : 's'}`;
    },
    run: () => probeReleaseMirrorCapabilitiesFromEnvironment(),
  });