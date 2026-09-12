/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { validateDockerCandidateAcceptance } from './docker-candidate-acceptance.js';
import { assertPublishedRuntimeBinding, normalizePublishedCandidateInputs,
  publishedCandidateBaselinePolicy } from './published-docker-candidate-policy.js';
import { verifyPublishedCandidateTrust } from './published-docker-candidate-trust.js';

export async function validatePublishedDockerCandidateAcceptance({
  candidateImageRef, baselineImageRef, candidateRevision, baselineRevision, baselineReleaseTag,
  repository = 'cloudbyday90/Harmoniarr', env = process.env, onProgress = () => {},
  runTrustCommandFn, validateRuntimeFn = validateDockerCandidateAcceptance,
} = {}) {
  let stage = 'trust inputs';
  try {
    const inputs = normalizePublishedCandidateInputs({ candidateImageRef, baselineImageRef,
      candidateRevision, baselineRevision, baselineReleaseTag, repository });
    stage = 'published provenance and baseline release verification';
    onProgress(stage);
    const trust = await verifyPublishedCandidateTrust(inputs, { runTrustCommandFn, env });
    stage = 'immutable runtime acceptance';
    const runtime = await validateRuntimeFn({
      candidateImageRef, baselineImageRef, candidateRevision, baselineRevision,
      allowLocalImages: false, env, onProgress,
    });
    stage = 'verified runtime binding';
    assertPublishedRuntimeBinding(runtime, inputs);
    return {
      ...runtime, validationKind: 'published-candidate-acceptance',
      provenanceVerified: true, publishedBaselineVerified: true, acceptedReleaseBaselineVerified: false,
      baselinePolicy: publishedCandidateBaselinePolicy, trust,
    };
  } catch {
    throw Object.assign(new Error(`Published candidate acceptance failed during ${stage}; no passed evidence was produced`), {
      code: 'published_candidate_acceptance_failed',
    });
  }
}
