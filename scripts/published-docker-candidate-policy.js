/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { defaultReleaseAssetNames, verifyReleaseContract } from './release-contract.js';
import { normalizePublishedImageInputs, publishedImagePredicateType } from './published-image-provenance-policy.js';

export { publishedImagePredicateType as publishedCandidatePredicateType };
export const publishedCandidateBaselinePolicy = 'operator-selected-published-release';

export function normalizePublishedCandidateInputs({
  candidateImageRef, baselineImageRef, candidateRevision, baselineRevision,
  baselineReleaseTag, repository = 'cloudbyday90/Harmoniarr',
} = {}) {
  const { imageName, signerWorkflow } = normalizePublishedImageInputs({ imageRef: candidateImageRef, revision: candidateRevision, repository });
  normalizePublishedImageInputs({ imageRef: baselineImageRef, revision: baselineRevision, repository });
  if (candidateImageRef === baselineImageRef || candidateRevision === baselineRevision) {
    throw new Error('Published upgrade acceptance requires distinct images and source revisions');
  }
  if (typeof baselineReleaseTag !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,127}$/.test(baselineReleaseTag)
    || baselineReleaseTag.includes('..') || baselineReleaseTag.endsWith('/')) {
    throw new Error('An explicit baseline release tag is required');
  }
  return { candidateImageRef, baselineImageRef, candidateRevision, baselineRevision,
    baselineReleaseTag, repository, imageName, signerWorkflow };
}

export function selectBaselineMetadataAsset(release, inputs) {
  if (!release || release.draft !== false || release.tag_name !== inputs.baselineReleaseTag
    || !Number.isSafeInteger(release.id) || release.id <= 0
    || typeof release.published_at !== 'string' || !Number.isFinite(Date.parse(release.published_at))) {
    throw new Error('The selected baseline is not an exact published GitHub release');
  }
  const assets = Array.isArray(release.assets)
    ? release.assets.filter((asset) => asset?.name === defaultReleaseAssetNames.metadata) : [];
  if (assets.length !== 1 || !Number.isSafeInteger(assets[0].id) || assets[0].id <= 0
    || !Number.isSafeInteger(assets[0].size) || assets[0].size <= 0 || assets[0].size > 131_072) {
    throw new Error('The selected baseline must contain one bounded official metadata asset');
  }
  return assets[0];
}

export function verifyBaselineMetadata(metadata, inputs) {
  if (typeof metadata?.repository !== 'string' || metadata.repository.toLowerCase() !== inputs.repository.toLowerCase()) {
    throw new Error('Baseline release metadata belongs to another repository');
  }
  verifyReleaseContract(metadata, {
    expectedDigest: inputs.baselineImageRef.slice(inputs.baselineImageRef.lastIndexOf('@') + 1),
    expectedImageName: inputs.imageName, expectedReleaseTag: inputs.baselineReleaseTag,
  });
  if (metadata.immutableImageRef !== inputs.baselineImageRef) throw new Error('Baseline release metadata refers to another image');
}

export function assertPublishedRuntimeBinding(runtime, inputs) {
  if (runtime?.status !== 'passed' || runtime.cleanupVerified !== true
    || runtime.validationKind !== 'immutable-candidate-acceptance' || runtime.artifactScope !== 'registry-digest-runtime') {
    throw new Error('Published candidate runtime acceptance is incomplete');
  }
  for (const [key, reference, revision] of [
    ['candidate', inputs.candidateImageRef, inputs.candidateRevision],
    ['baseline', inputs.baselineImageRef, inputs.baselineRevision],
  ]) {
    const actual = runtime[key];
    if (actual?.kind !== 'registry-digest' || actual.reference !== reference || actual.revision !== revision
      || !/^sha256:[a-f0-9]{64}$/.test(actual.imageId ?? '')) {
      throw new Error('Published candidate runtime identity does not match the verified inputs');
    }
  }
}
