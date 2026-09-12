/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { assertCandidateRevision } from './docker-candidate-identity.js';
import { defaultReleaseAssetNames, verifyReleaseContract } from './release-contract.js';

export const publishedCandidatePredicateType = 'https://slsa.dev/provenance/v1';
export const publishedCandidateBaselinePolicy = 'operator-selected-published-release';

export function normalizePublishedCandidateInputs({
  candidateImageRef, baselineImageRef, candidateRevision, baselineRevision,
  baselineReleaseTag, repository = 'cloudbyday90/Harmoniarr',
} = {}) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,99}\/[a-zA-Z0-9][a-zA-Z0-9_.-]{0,99}$/.test(repository ?? '')) {
    throw new Error('A GitHub owner and repository are required');
  }
  const imageName = `ghcr.io/${repository.toLowerCase()}`;
  for (const reference of [candidateImageRef, baselineImageRef]) {
    if (typeof reference !== 'string' || !reference.startsWith(`${imageName}@`)
      || !/^sha256:[a-f0-9]{64}$/.test(reference.slice(imageName.length + 1))) {
      throw new Error('Published acceptance requires canonical GHCR SHA-256 digest references');
    }
  }
  assertCandidateRevision(candidateRevision);
  assertCandidateRevision(baselineRevision);
  if (candidateImageRef === baselineImageRef || candidateRevision === baselineRevision) {
    throw new Error('Published upgrade acceptance requires distinct images and source revisions');
  }
  if (typeof baselineReleaseTag !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,127}$/.test(baselineReleaseTag)
    || baselineReleaseTag.includes('..') || baselineReleaseTag.endsWith('/')) {
    throw new Error('An explicit baseline release tag is required');
  }
  return { candidateImageRef, baselineImageRef, candidateRevision, baselineRevision,
    baselineReleaseTag, repository, imageName, signerWorkflow: `${repository}/.github/workflows/release-image.yml` };
}

export function parseVerifiedImageAttestations(text, { reference, imageName }) {
  const records = JSON.parse(text);
  const digest = reference.split('@sha256:')[1];
  if (!Array.isArray(records) || records.length === 0 || records.length > 10) {
    throw new Error('Published image verification did not return bounded attestations');
  }
  const matching = records.filter((record) => {
    const result = record?.verificationResult;
    const certificate = result?.signature?.certificate;
    return certificate && typeof certificate === 'object' && !Array.isArray(certificate)
      && result.statement?.predicateType === publishedCandidatePredicateType
      && Array.isArray(result.statement.subject)
      && result.statement.subject.some((subject) => subject?.name === imageName && subject.digest?.sha256 === digest);
  });
  if (matching.length === 0) throw new Error('Verified image attestations do not bind the expected digest');
  // Signature, issuer, source digest, workflow and runner restrictions were
  // enforced by the live gh verifier. Predicate data is not an identity source.
  return { reference, attestationCount: matching.length };
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
