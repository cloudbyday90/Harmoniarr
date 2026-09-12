/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { assertCandidateRevision } from './docker-candidate-identity.js';

export const publishedImagePredicateType = 'https://slsa.dev/provenance/v1';

export function normalizePublishedImageInputs({ imageRef, revision, repository = 'cloudbyday90/Harmoniarr' } = {}) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,99}\/[a-zA-Z0-9][a-zA-Z0-9_.-]{0,99}$/.test(repository ?? '')) {
    throw new Error('A GitHub owner and repository are required');
  }
  const imageName = `ghcr.io/${repository.toLowerCase()}`;
  if (typeof imageRef !== 'string' || !imageRef.startsWith(`${imageName}@`)
    || !/^sha256:[a-f0-9]{64}$/.test(imageRef.slice(imageName.length + 1))) {
    throw new Error('Published image verification requires a canonical GHCR SHA-256 digest reference');
  }
  assertCandidateRevision(revision);
  return { imageRef, revision, repository, imageName, signerWorkflow: `${repository}/.github/workflows/release-image.yml` };
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
      && result.statement?.predicateType === publishedImagePredicateType
      && Array.isArray(result.statement.subject)
      && result.statement.subject.some((subject) => subject?.name === imageName && subject.digest?.sha256 === digest);
  });
  if (matching.length === 0) throw new Error('Verified image attestations do not bind the expected digest');
  // Called only with a successful live gh verification response. Source identity
  // comes from the certificate restrictions, never arbitrary predicate fields.
  return { reference, attestationCount: matching.length };
}

export function projectPublishedImageProvenance(result, inputs) {
  if (result?.schemaVersion !== 1 || result.verificationKind !== 'published-image-provenance'
    || result.status !== 'passed' || result.provenanceVerified !== true
    || result.reference !== inputs.imageRef || result.revision !== inputs.revision
    || result.repository !== inputs.repository || result.signerWorkflow !== inputs.signerWorkflow
    || result.predicateType !== publishedImagePredicateType
    || !Number.isSafeInteger(result.attestationCount) || result.attestationCount < 1 || result.attestationCount > 10
    || typeof result.verifiedAt !== 'string' || !Number.isFinite(Date.parse(result.verifiedAt))) {
    throw new Error('Published image provenance evidence is incomplete or mismatched');
  }
  return {
    schemaVersion: 1, verificationKind: 'published-image-provenance', status: 'passed', provenanceVerified: true,
    reference: inputs.imageRef, revision: inputs.revision, repository: inputs.repository,
    signerWorkflow: inputs.signerWorkflow, predicateType: publishedImagePredicateType,
    attestationCount: result.attestationCount, verifiedAt: result.verifiedAt,
  };
}
