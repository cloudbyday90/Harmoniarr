/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { readFile } from 'node:fs/promises';
import { copyOrasArtifactGraph } from './oras-registry.js';
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

export function createMirrorTagCopyReference(imageName, fullTags) {
  if (!imageName?.trim()) {
    throw new Error('imageName is required');
  }

  const tagNames = [...new Set(
    (Array.isArray(fullTags) ? fullTags : [])
      .filter((tag) => typeof tag === 'string' && tag.startsWith(`${imageName.trim()}:`))
      .map((tag) => tag.slice(`${imageName.trim()}:`.length).trim())
      .filter(Boolean),
  )];

  if (tagNames.length === 0) {
    throw new Error(`No tag references were found for ${imageName}`);
  }

  return `${imageName.trim()}:${tagNames.join(',')}`;
}

export async function promoteReleaseMirrorTrust({
  copyOrasArtifactGraphFn = copyOrasArtifactGraph,
  env = process.env,
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

  if (!sourceRegistryBinding) {
    throw new Error(`Canonical registry binding ${plan.canonicalRegistry} is not configured`);
  }

  if (!targetRegistryBinding) {
    throw new Error(`Mirror registry binding ${mirrorName} is not configured`);
  }

  if (sourceRegistryBinding.imageName !== metadata.imageName) {
    throw new Error(`Canonical registry binding ${sourceRegistryBinding.imageName} does not match release metadata image ${metadata.imageName}`);
  }

  if (targetRegistryBinding.imageName !== mirror.imageName) {
    throw new Error(`Mirror registry binding ${targetRegistryBinding.imageName} does not match release metadata mirror ${mirror.imageName}`);
  }

  return copyOrasArtifactGraphFn({
    env,
    fromReference: metadata.immutableImageRef,
    sourceRegistryBinding,
    targetRegistryBinding,
    toReference: createMirrorTagCopyReference(mirror.imageName, mirror.tags),
  });
}

export async function promoteReleaseMirrorTrustFromEnvironment(env = process.env, { args = process.argv.slice(2) } = {}) {
  const { values } = parseReleaseScriptOptions({
    ...imageRegistryPlanCliOptions,
    ...releaseMirrorCliOptions,
  }, { args });
  const { metadataPath, mirrorName } = resolveReleaseMirrorInputs({ env, values });
  const metadataText = await readFile(metadataPath, 'utf8');
  return promoteReleaseMirrorTrust({
    env,
    metadata: parseReleaseMetadata(metadataText),
    mirrorName,
    plan: resolveImageRegistryPlanFromInputs(resolveImageRegistryPlanInputs({ env, values })),
  });
}

await runDirectScriptTask(import.meta, {
    prefix: 'harmoniarr-promote-release-mirror-trust',
    renderSuccessMessage: ({ toReference, usedTargetDistributionSpec, usedFallback }) => {
      const fallbackSummary = usedFallback ? ' with fallback distribution spec' : '';
      return `Promoted trusted mirror refs to ${toReference} using ${usedTargetDistributionSpec}${fallbackSummary}`;
    },
    run: () => promoteReleaseMirrorTrustFromEnvironment(),
  });