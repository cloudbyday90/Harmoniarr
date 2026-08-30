/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { assertArtistDetailLocalTimingArtifactContract } from './artist-detail-local-timing-batch-evidence.js';

const assessmentDefinitions = Object.freeze({
  inspect_client_loading_lifecycle: Object.freeze({
    observation: 'discography_still_loading',
    summary: 'Discography remained loading in one or more samples.',
    nextStep: 'Inspect the Artist Detail loading and render path before cache work.',
  }),
  inspect_discography_availability: Object.freeze({
    observation: 'discography_unavailable',
    summary: 'Discography was unavailable in one or more samples.',
    nextStep: 'Inspect Artist Detail availability and error rendering before cache work.',
  }),
  inspect_provider_cache_path: Object.freeze({
    observation: 'provider_discography_fallback',
    summary: 'The capture used the provider Discography fallback path.',
    nextStep: 'Compare provider cache evidence before changing Artist Detail SWR behavior.',
  }),
  reproduce_affected_case: Object.freeze({
    observation: 'discography_ready_with_local_projection',
    summary: 'Discography settled with the local projection path.',
    nextStep: 'Reproduce the reported account and artist before changing cache behavior.',
  }),
  reproduce_route_variation: Object.freeze({
    observation: 'artist_detail_route_varies',
    summary: 'The capture used more than one Artist Detail route outcome.',
    nextStep: 'Reproduce why the local projection route varies before cache work.',
  }),
});

export const artistDetailLocalTimingAssessmentNextActions = Object.freeze(
  Object.keys(assessmentDefinitions),
);

function isBatchEvidence(evidence) {
  return evidence.artifactType === 'artist_detail_local_timing_batch';
}

function getPresentationStateCounts(evidence) {
  if (isBatchEvidence(evidence)) {
    return evidence.presentation.stateCounts;
  }

  return Object.freeze({
    ready: evidence.presentation.state === 'ready' ? 1 : 0,
    still_loading: evidence.presentation.state === 'still_loading' ? 1 : 0,
    unavailable: evidence.presentation.state === 'unavailable' ? 1 : 0,
  });
}

function getOutcomeCounts(evidence) {
  if (isBatchEvidence(evidence)) {
    return evidence.outcomeCounts;
  }

  return Object.freeze({
    local_projection: evidence.outcome === 'local_projection' ? 1 : 0,
    provider_fallback_after_local_lookup: evidence.outcome === 'provider_fallback_after_local_lookup' ? 1 : 0,
    provider_fallback_after_operator_projection: evidence.outcome === 'provider_fallback_after_operator_projection' ? 1 : 0,
  });
}

function getNextAction(evidence) {
  const presentationStateCounts = getPresentationStateCounts(evidence);
  if (presentationStateCounts.unavailable > 0) {
    return 'inspect_discography_availability';
  }
  if (presentationStateCounts.still_loading > 0) {
    return 'inspect_client_loading_lifecycle';
  }

  const outcomeCounts = getOutcomeCounts(evidence);
  const distinctOutcomes = Object.values(outcomeCounts).filter((count) => count > 0).length;
  if (distinctOutcomes > 1) {
    return 'reproduce_route_variation';
  }
  if (outcomeCounts.provider_fallback_after_local_lookup > 0
    || outcomeCounts.provider_fallback_after_operator_projection > 0) {
    return 'inspect_provider_cache_path';
  }

  return 'reproduce_affected_case';
}

/**
 * Derives one conservative investigation action from a schema-validated local
 * Artist Detail timing artifact. The result contains fixed labels only and
 * never carries timing values, endpoints, IDs, users, URLs, or page content.
 */
export function assessArtistDetailLocalTimingEvidence(evidence) {
  const validatedEvidence = assertArtistDetailLocalTimingArtifactContract(evidence);
  const nextAction = getNextAction(validatedEvidence);
  const definition = assessmentDefinitions[nextAction];

  return Object.freeze({
    captureScope: isBatchEvidence(validatedEvidence) ? 'repeated_capture' : 'single_capture',
    nextAction,
    observation: definition.observation,
  });
}

/**
 * Renders fixed local operator guidance for a validated assessment. Rendering
 * does not interpolate any evidence value, which prevents the command output
 * from becoming a diagnostic-data side channel.
 */
export function renderArtistDetailLocalTimingAssessment(evidence) {
  const assessment = assessArtistDetailLocalTimingEvidence(evidence);
  const definition = assessmentDefinitions[assessment.nextAction];
  const captureLabel = assessment.captureScope === 'repeated_capture'
    ? 'Repeated local capture'
    : 'Single local capture';

  return [
    'Artist Detail local timing assessment',
    '',
    `Capture: ${captureLabel}`,
    `Observed: ${definition.summary}`,
    `Next action: ${definition.nextStep}`,
  ].join('\n');
}
