/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { assertCandidateRevision } from './docker-candidate-identity.js';
import { resolveReleaseImagePlan } from './image-registries.js';
import { defaultReleaseAssetNames } from './release-contract.js';

export function normalizeReleaseDraftInputs({ repository, releaseTag, revision, releaseId = null } = {}) {
  if (typeof repository !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,99}\/[a-zA-Z0-9][a-zA-Z0-9_.-]{0,99}$/.test(repository)) {
    throw new Error('A GitHub owner and repository are required');
  }
  if (typeof releaseTag !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(releaseTag) || releaseTag.includes('..')) {
    throw new Error('An explicit release version tag is required');
  }
  assertCandidateRevision(revision);
  if (releaseId !== null && (!Number.isSafeInteger(releaseId) || releaseId <= 0)) throw new Error('A numeric release identifier is required');
  const [repositoryOwner, repositoryName] = repository.split('/');
  const plan = resolveReleaseImagePlan({ releaseTag, repositoryOwner, repositoryName });
  return { repository, releaseTag, revision, releaseId, imageName: plan.imageName,
    version: plan.version, isPrerelease: plan.isPrerelease,
    marker: `<!-- harmoniarr-release-image:v1 ${repository.toLowerCase()} ${releaseTag} ${revision} -->` };
}

export function assertOwnedRelease(release, inputs, { published = false } = {}) {
  const body = release?.body;
  const ownedMarker = typeof body === 'string' && body.includes(inputs.marker)
    && body.split('<!-- harmoniarr-release-image:').length === 2;
  if (!release || !Number.isSafeInteger(release.id) || release.id <= 0
    || (inputs.releaseId !== null && release.id !== inputs.releaseId)
    || release.tag_name !== inputs.releaseTag || release.target_commitish !== inputs.revision
    || !ownedMarker || release.prerelease !== inputs.isPrerelease
    || release.draft !== !published) throw new Error('The release does not match the owned draft and source identity');
  if (published && (release.immutable !== true || typeof release.published_at !== 'string'
    || !Number.isFinite(Date.parse(release.published_at)))) throw new Error('The published release is not immutable');
  return release;
}

export function assertReleaseAssetInventory(remoteAssets, localAssets, { complete = false } = {}) {
  if (!Array.isArray(remoteAssets) || remoteAssets.length > 4) throw new Error('Unexpected release asset inventory');
  const expectedNames = new Set(Object.values(defaultReleaseAssetNames));
  const seen = new Set();
  for (const remote of remoteAssets) {
    const local = localAssets.find((asset) => asset.name === remote.name);
    if (!expectedNames.has(remote.name) || seen.has(remote.name) || !local
      || !Number.isSafeInteger(remote.id) || remote.id <= 0 || remote.state !== 'uploaded'
      || remote.size !== local.size || remote.digest !== `sha256:${local.sha256}`) {
      throw new Error('A release asset differs from the validated bytes or is incomplete');
    }
    seen.add(remote.name);
  }
  if (complete && seen.size !== 4) throw new Error('The release must contain all four validated assets');
  return seen;
}

export function projectReleasePublication(result, inputs) {
  if (result?.schemaVersion !== 1 || result.validationKind !== 'immutable-release-publication' || result.status !== 'passed'
    || result.releaseId !== inputs.releaseId || result.repository !== inputs.repository || result.releaseTag !== inputs.releaseTag
    || result.sourceRevision !== inputs.revision || result.imageRef !== inputs.imageRef
    || result.draft !== false || result.published !== true || result.immutable !== true
    || result.releaseAttestationVerified !== true || result.prerelease !== inputs.isPrerelease
    || typeof result.publishedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(result.publishedAt)
    || !Number.isFinite(Date.parse(result.publishedAt)) || !Array.isArray(result.assets) || result.assets.length !== 4) {
    throw new Error('Release publication evidence is incomplete or does not match the expected release');
  }
  const names = new Set();
  for (const asset of result.assets) {
    if (!Object.values(defaultReleaseAssetNames).includes(asset?.name) || names.has(asset.name)
      || !Number.isSafeInteger(asset.size) || asset.size <= 0 || !/^[a-f0-9]{64}$/.test(asset.sha256 ?? '')) {
      throw new Error('Release publication asset evidence is invalid');
    }
    names.add(asset.name);
  }
  return { schemaVersion: 1, validationKind: 'immutable-release-publication', status: 'passed',
    releaseId: inputs.releaseId, repository: inputs.repository, releaseTag: inputs.releaseTag,
    sourceRevision: inputs.revision, imageRef: inputs.imageRef, draft: false, published: true, immutable: true,
    releaseAttestationVerified: true, prerelease: inputs.isPrerelease, publishedAt: result.publishedAt,
    assets: result.assets.map(({ name, size, sha256 }) => ({ name, size, sha256 })) };
}
