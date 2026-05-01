/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { appendGitHubOutputEntries } from './github-actions-output.js';
import { resolveImageRegistries, resolveReleaseImagePlan } from './image-registries.js';
import { resolveImageRegistryPlanInputs } from './release-script-inputs.js';
import { getOptionalEnv } from './script-environment.js';
import { runDirectScriptTask } from './script-runtime.js';

export function resolveImageRegistryPlanFromInputs({
  dockerHubNamespace,
  dockerHubRepository,
  enableDockerHub,
  enableTrustedDockerHubMirror,
  releaseTag,
  repositoryName,
  repositoryOwner,
} = {}) {
  const options = {
    dockerHubNamespace,
    dockerHubRepository,
    enableDockerHub,
    enableTrustedDockerHubMirror,
    repositoryName,
    repositoryOwner,
  };

  return releaseTag
    ? resolveReleaseImagePlan({ releaseTag, ...options })
    : resolveImageRegistries(options);
}

export function resolveImageRegistryPlanFromEnvironment(env = process.env, { args = process.argv.slice(2) } = {}) {
  return resolveImageRegistryPlanFromInputs(resolveImageRegistryPlanInputs({ args, env }));
}

export async function writeImageRegistryPlanToGitHubOutput(plan, outputPath) {
  if (!outputPath) {
    return;
  }

  const ghcrReferrersPlan = plan.registries?.ghcr?.referrersPlan ?? {};
  const dockerHubReferrersPlan = plan.registries?.dockerHub?.referrersPlan ?? {};
  const entries = [
    { name: 'canonical_registry', value: plan.canonicalRegistry },
    { name: 'canonical_referrers_distribution_spec', value: ghcrReferrersPlan.distributionSpec ?? '' },
    { name: 'canonical_referrers_fallback_distribution_spec', value: ghcrReferrersPlan.fallbackDistributionSpec ?? '' },
    { name: 'dockerhub_enabled', value: plan.dockerHubEnabled },
    { name: 'dockerhub_image_name', value: plan.dockerHubImageName ?? '' },
    { name: 'dockerhub_namespace', value: plan.dockerHubNamespace ?? '' },
    { name: 'dockerhub_repository', value: plan.dockerHubRepository ?? '' },
    { name: 'dockerhub_referrers_distribution_spec', value: dockerHubReferrersPlan.distributionSpec ?? '' },
    { name: 'dockerhub_referrers_fallback_distribution_spec', value: dockerHubReferrersPlan.fallbackDistributionSpec ?? '' },
    { name: 'trusted_dockerhub_mirror_enabled', value: plan.trustedDockerHubMirrorEnabled },
    { name: 'enabled_registry_keys', value: (plan.enabledRegistryKeys ?? []).join(',') },
    { name: 'ghcr_image_name', value: plan.ghcrImageName },
    { name: 'ghcr_package_name', value: plan.ghcrPackageName },
    { name: 'image_name', value: plan.imageName },
    { name: 'mirror_registry_keys', value: (plan.mirrorRegistryKeys ?? []).join(',') },
    { name: 'primary_image_name', value: plan.primaryImageName },
    { name: 'docker_metadata_images', value: plan.dockerMetadataImages },
  ];

  if (plan.releaseTag) {
    entries.push({ name: 'release_tag', value: plan.releaseTag });
  }

  if (plan.version) {
    entries.push({ name: 'version', value: plan.version });
    entries.push({ name: 'is_prerelease', value: plan.isPrerelease });
  }

  await appendGitHubOutputEntries(outputPath, entries);
}

await runDirectScriptTask(import.meta, {
    prefix: 'harmoniarr-write-image-registry-config',
    renderSuccessMessage: ({ dockerHubEnabled, imageName, releaseTag }) => {
      const releaseSummary = releaseTag ? ` for ${releaseTag}` : '';
      const dockerHubSummary = dockerHubEnabled ? ' with Docker Hub mirror enabled' : '';
      return `Resolved image registry plan${releaseSummary}: ${imageName}${dockerHubSummary}`;
    },
    run: async () => {
      const plan = resolveImageRegistryPlanFromEnvironment();
      await writeImageRegistryPlanToGitHubOutput(plan, getOptionalEnv('GITHUB_OUTPUT'));
      return plan;
    },
  });