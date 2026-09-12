/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { normalizeReleaseDraftInputs } from './release-draft-lifecycle-policy.js';
import { normalizePublishedImageInputs } from './published-image-provenance-policy.js';

export function assertReleaseCandidateTag(tag) {
  if (typeof tag !== 'string' || !/^candidate-[a-f0-9]{40}-[1-9][0-9]{0,19}-[1-9][0-9]{0,19}$/.test(tag)) {
    throw new Error('A candidate tag must bind the full source commit, workflow run and attempt');
  }
  return tag;
}

function normalizeContext({ repository, releaseTag, revision, dockerHubImageName = null }) {
  const inputs = normalizeReleaseDraftInputs({ repository, releaseTag, revision });
  if (dockerHubImageName !== null && (typeof dockerHubImageName !== 'string'
    || !/^[a-z0-9][a-z0-9_-]{0,99}\/[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(dockerHubImageName)
    || dockerHubImageName.split('/')[0] === 'localhost'
    || dockerHubImageName.length > 201)) throw new Error('An explicit Docker Hub namespace and repository are required');
  const aliases = [...new Set([inputs.version, inputs.releaseTag, ...(inputs.isPrerelease ? [] : ['latest'])])];
  if (aliases.some((tag) => !/^[a-zA-Z0-9_][a-zA-Z0-9_.-]{0,127}$/.test(tag))) throw new Error('Release aliases must be valid image tags');
  return { repository: inputs.repository, releaseTag: inputs.releaseTag, revision: inputs.revision,
    imageName: inputs.imageName, dockerHubImageName, aliases, isPrerelease: inputs.isPrerelease };
}

export function createReleaseCandidateTagPlan({ runId, runAttempt, ...options }) {
  const context = normalizeContext(options);
  if (![runId, runAttempt].every((value) => typeof value === 'string' && /^[1-9][0-9]{0,19}$/.test(value))) {
    throw new Error('A positive workflow run identifier and attempt are required');
  }
  const candidateTag = assertReleaseCandidateTag(`candidate-${context.revision}-${runId}-${runAttempt}`);
  const imageNames = [context.imageName, ...(context.dockerHubImageName ? [context.dockerHubImageName] : [])];
  return { candidateTag, candidateTags: imageNames.map((name) => `${name}:${candidateTag}`),
    repository: context.repository, sourceRevision: context.revision, runId, runAttempt };
}

export function createReleaseImagePromotionPlan({ imageRef, ...options }) {
  const context = normalizeContext(options);
  normalizePublishedImageInputs({ imageRef, revision: context.revision, repository: context.repository });
  const digest = imageRef.split('@')[1];
  const sources = [{ registry: 'ghcr', imageName: context.imageName },
    ...(context.dockerHubImageName ? [{ registry: 'dockerHub', imageName: context.dockerHubImageName }] : [])]
    .map((source) => ({ ...source, source: `${source.imageName}@${digest}`,
      targets: context.aliases.map((alias) => `${source.imageName}:${alias}`) }));
  return { repository: context.repository, releaseTag: context.releaseTag, sourceRevision: context.revision,
    imageRef, digest, isPrerelease: context.isPrerelease, sources };
}

export function readReleaseTagWorkflowInputs(env) {
  for (const key of ['HARMONIARR_REPOSITORY', 'HARMONIARR_RELEASE_TAG', 'HARMONIARR_RELEASE_REVISION']) {
    if (typeof env[key] !== 'string' || !env[key].trim()) throw new Error(`${key} is required`);
  }
  if (env.GITHUB_EVENT_NAME !== 'workflow_dispatch' || env.GITHUB_SHA !== env.HARMONIARR_RELEASE_REVISION
    || env.GITHUB_REPOSITORY?.toLowerCase() !== env.HARMONIARR_REPOSITORY.toLowerCase()) {
    throw new Error('Image tag changes must match the dispatched repository and source commit');
  }
  return { repository: env.HARMONIARR_REPOSITORY, releaseTag: env.HARMONIARR_RELEASE_TAG,
    revision: env.HARMONIARR_RELEASE_REVISION, dockerHubImageName: env.HARMONIARR_DOCKERHUB_IMAGE_NAME || null };
}

export function projectReleaseImagePromotion(result, plan) {
  if (result?.schemaVersion !== 1 || result.validationKind !== 'release-image-tag-promotion' || result.status !== 'passed'
    || result.repository !== plan.repository || result.releaseTag !== plan.releaseTag || result.sourceRevision !== plan.sourceRevision
    || result.imageRef !== plan.imageRef || result.digest !== plan.digest || result.sourceDigestsVerified !== true
    || result.aliasesVerified !== true || typeof result.verifiedAt !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(result.verifiedAt)
    || !Number.isFinite(Date.parse(result.verifiedAt)) || !Array.isArray(result.registries)
    || result.registries.length !== plan.sources.length) throw new Error('Image promotion evidence is incomplete or unbound');
  const registries = plan.sources.map((source, index) => {
    const actual = result.registries[index];
    if (actual?.registry !== source.registry || actual.source !== source.source || actual.digest !== plan.digest
      || !Array.isArray(actual.targets) || actual.targets.length !== source.targets.length
      || actual.targets.some((target, targetIndex) => target !== source.targets[targetIndex])) {
      throw new Error('Image promotion aliases do not match the approved plan');
    }
    return { registry: source.registry, source: source.source, digest: plan.digest, targets: [...source.targets] };
  });
  return { schemaVersion: 1, validationKind: 'release-image-tag-promotion', status: 'passed',
    repository: plan.repository, releaseTag: plan.releaseTag, sourceRevision: plan.sourceRevision,
    imageRef: plan.imageRef, digest: plan.digest, sourceDigestsVerified: true, aliasesVerified: true,
    registries, verifiedAt: result.verifiedAt };
}
