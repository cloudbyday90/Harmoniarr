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

import { isDeepStrictEqual } from 'node:util';

import { artistDetailPresentationStates } from './artist-detail-local-presentation-evidence.js';
import { assertArtistDetailLocalTimingEvidenceContract } from './artist-detail-local-timing-evidence.js';

const endpointOrder = Object.freeze(['local_metadata', 'operator_projection', 'discography']);
const outcomeOrder = Object.freeze([
  'local_projection',
  'provider_fallback_after_local_lookup',
  'provider_fallback_after_operator_projection',
]);
const presentationStateOrder = artistDetailPresentationStates;
export const minimumArtistDetailTimingBatchSamples = 2;
export const maximumArtistDetailTimingBatchSamples = 5;
export const artistDetailLocalTimingBatchArtifactType = 'artist_detail_local_timing_batch';

function assertObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function assertOnlyAllowedFields(value, allowedFields, label) {
  assertObject(value, label);

  for (const field of Object.keys(value)) {
    if (!allowedFields.has(field)) {
      throw new Error(`${label}.${field} is not allowed in local Artist Detail timing batch evidence`);
    }
  }
}

function assertIsoTimestamp(value, label) {
  if (typeof value !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(value)
    || Number.isNaN(Date.parse(value))) {
    throw new Error(`${label} must be an ISO timestamp`);
  }
}

function assertSampleCount(value, label) {
  if (!Number.isSafeInteger(value)
    || value < minimumArtistDetailTimingBatchSamples
    || value > maximumArtistDetailTimingBatchSamples) {
    throw new Error(`${label} must be between ${minimumArtistDetailTimingBatchSamples} and ${maximumArtistDetailTimingBatchSamples}`);
  }
}

function normalizeOutcomeCounts(counts, sampleCount) {
  assertOnlyAllowedFields(counts, new Set(outcomeOrder), 'local Artist Detail timing batch evidence outcomeCounts');

  const normalizedCounts = {};
  let countedSamples = 0;
  for (const outcome of outcomeOrder) {
    const count = counts[outcome];
    if (!Number.isSafeInteger(count) || count < 0 || count > sampleCount) {
      throw new Error(`local Artist Detail timing batch evidence outcomeCounts.${outcome} is invalid`);
    }

    normalizedCounts[outcome] = count;
    countedSamples += count;
  }

  if (countedSamples !== sampleCount) {
    throw new Error('local Artist Detail timing batch evidence outcomeCounts must total sampleCount');
  }

  return Object.freeze(normalizedCounts);
}

function normalizePresentationStateCounts(counts, sampleCount) {
  assertOnlyAllowedFields(counts, new Set(presentationStateOrder), 'local Artist Detail timing batch evidence presentation stateCounts');

  const normalizedCounts = {};
  let countedSamples = 0;
  for (const state of presentationStateOrder) {
    const count = counts[state];
    if (!Number.isSafeInteger(count) || count < 0 || count > sampleCount) {
      throw new Error(`local Artist Detail timing batch evidence presentation stateCounts.${state} is invalid`);
    }

    normalizedCounts[state] = count;
    countedSamples += count;
  }

  if (countedSamples !== sampleCount) {
    throw new Error('local Artist Detail timing batch evidence presentation stateCounts must total sampleCount');
  }

  return Object.freeze(normalizedCounts);
}

function normalizeMetricSummary(summary, label) {
  assertOnlyAllowedFields(summary, new Set(['maximumMs', 'minimumMs', 'p50Ms', 'p95Ms']), label);

  const normalizedSummary = {};
  for (const field of ['minimumMs', 'p50Ms', 'p95Ms', 'maximumMs']) {
    if (!Number.isSafeInteger(summary[field]) || summary[field] < 0 || summary[field] > 3_600_000) {
      throw new Error(`${label}.${field} is invalid`);
    }
    normalizedSummary[field] = summary[field];
  }

  if (normalizedSummary.minimumMs > normalizedSummary.p50Ms
    || normalizedSummary.p50Ms > normalizedSummary.p95Ms
    || normalizedSummary.p95Ms > normalizedSummary.maximumMs) {
    throw new Error(`${label} is not ordered`);
  }

  return Object.freeze(normalizedSummary);
}

function normalizeEndpointTiming(entry, sampleCount) {
  assertOnlyAllowedFields(entry, new Set([
    'clientRequestDurationMs',
    'endpoint',
    'responseEndMs',
    'sampleCount',
    'startTimeMs',
  ]), 'local Artist Detail timing batch evidence endpoint timing');

  if (!endpointOrder.includes(entry.endpoint)) {
    throw new Error('local Artist Detail timing batch evidence endpoint is invalid');
  }
  if (!Number.isSafeInteger(entry.sampleCount) || entry.sampleCount < 1 || entry.sampleCount > sampleCount) {
    throw new Error('local Artist Detail timing batch evidence endpoint sampleCount is invalid');
  }

  return Object.freeze({
    clientRequestDurationMs: normalizeMetricSummary(
      entry.clientRequestDurationMs,
      'local Artist Detail timing batch evidence client request duration',
    ),
    endpoint: entry.endpoint,
    responseEndMs: normalizeMetricSummary(
      entry.responseEndMs,
      'local Artist Detail timing batch evidence response end',
    ),
    sampleCount: entry.sampleCount,
    startTimeMs: normalizeMetricSummary(
      entry.startTimeMs,
      'local Artist Detail timing batch evidence start time',
    ),
  });
}

function normalizePresentationSummary(summary, sampleCount) {
  assertOnlyAllowedFields(summary, new Set([
    'observedAtMs',
    'stateCounts',
    'stateIsConsistent',
  ]), 'local Artist Detail timing batch evidence presentation');

  if (typeof summary.stateIsConsistent !== 'boolean') {
    throw new Error('local Artist Detail timing batch evidence presentation stateIsConsistent is invalid');
  }

  return Object.freeze({
    observedAtMs: normalizeMetricSummary(
      summary.observedAtMs,
      'local Artist Detail timing batch evidence presentation observation time',
    ),
    stateCounts: normalizePresentationStateCounts(summary.stateCounts, sampleCount),
    stateIsConsistent: summary.stateIsConsistent,
  });
}

function interpolatePercentile(sortedValues, percentile) {
  const offset = (sortedValues.length - 1) * percentile;
  const lowerIndex = Math.floor(offset);
  const upperIndex = Math.ceil(offset);
  const lowerValue = sortedValues[lowerIndex];
  const upperValue = sortedValues[upperIndex];
  return Math.round(lowerValue + ((upperValue - lowerValue) * (offset - lowerIndex)));
}

function createMetricSummary(values) {
  const sortedValues = [...values].sort((left, right) => left - right);
  return Object.freeze({
    maximumMs: sortedValues.at(-1),
    minimumMs: sortedValues[0],
    p50Ms: interpolatePercentile(sortedValues, 0.5),
    p95Ms: interpolatePercentile(sortedValues, 0.95),
  });
}

function createEndpointTimings(samples) {
  return Object.freeze(endpointOrder.flatMap((endpoint) => {
    const requests = samples.flatMap((sample) => sample.requests.filter((request) => request.endpoint === endpoint));
    if (requests.length === 0) {
      return [];
    }

    return [Object.freeze({
      clientRequestDurationMs: createMetricSummary(
        requests.map((request) => request.timing.clientRequestDurationMs),
      ),
      endpoint,
      responseEndMs: createMetricSummary(requests.map((request) => request.timing.responseEndMs)),
      sampleCount: requests.length,
      startTimeMs: createMetricSummary(requests.map((request) => request.timing.startTimeMs)),
    })];
  }));
}

function createOutcomeCounts(samples) {
  const counts = Object.fromEntries(outcomeOrder.map((outcome) => [outcome, 0]));
  for (const sample of samples) {
    counts[sample.outcome] += 1;
  }
  return Object.freeze(counts);
}

function createPresentationSummary(samples) {
  const stateCounts = Object.fromEntries(presentationStateOrder.map((state) => [state, 0]));
  for (const sample of samples) {
    stateCounts[sample.presentation.state] += 1;
  }

  return Object.freeze({
    observedAtMs: createMetricSummary(samples.map((sample) => sample.presentation.observedAtMs)),
    stateCounts: Object.freeze(stateCounts),
    stateIsConsistent: Object.values(stateCounts).filter((count) => count > 0).length === 1,
  });
}

function normalizeSamples(samples) {
  if (!Array.isArray(samples)) {
    throw new Error('local Artist Detail timing batch evidence samples must be an array');
  }
  assertSampleCount(samples.length, 'local Artist Detail timing batch evidence samples');
  return Object.freeze(samples.map(assertArtistDetailLocalTimingEvidenceContract));
}

/**
 * Aggregates two to five read-only Artist Detail samples. The artifact keeps
 * only the bounded data already allowed in a single sample; it does not retain
 * artist identifiers, URLs, users, credentials, request bodies, or headers.
 *
 * Percentiles use linear interpolation over the sorted, rounded millisecond
 * values. With this intentionally small diagnostic sample, p95 is a bounded
 * high-end indicator, not a population estimate.
 */
export function createArtistDetailLocalTimingBatchEvidence({
  capturedAt = new Date().toISOString(),
  samples,
} = {}) {
  assertIsoTimestamp(capturedAt, 'local Artist Detail timing batch evidence capturedAt');
  const normalizedSamples = normalizeSamples(samples);
  const outcomeCounts = createOutcomeCounts(normalizedSamples);
  const presentation = createPresentationSummary(normalizedSamples);

  return Object.freeze({
    artifactType: artistDetailLocalTimingBatchArtifactType,
    capturedAt,
    endpointTimings: createEndpointTimings(normalizedSamples),
    outcomeCounts,
    outcomeIsConsistent: Object.values(outcomeCounts).filter((count) => count > 0).length === 1,
    presentation,
    sampleCount: normalizedSamples.length,
    samples: normalizedSamples,
    schemaVersion: 2,
  });
}

/**
 * Revalidates the aggregate before persistence. Derived values are checked
 * against the supplied samples so the artifact cannot be used as a side
 * channel for unbounded fields or altered statistics.
 */
export function assertArtistDetailLocalTimingBatchEvidenceContract(evidence) {
  assertOnlyAllowedFields(evidence, new Set([
    'artifactType',
    'capturedAt',
    'endpointTimings',
    'outcomeCounts',
    'outcomeIsConsistent',
    'presentation',
    'sampleCount',
    'samples',
    'schemaVersion',
  ]), 'local Artist Detail timing batch evidence');

  if (evidence.artifactType !== artistDetailLocalTimingBatchArtifactType) {
    throw new Error('local Artist Detail timing batch evidence artifactType is invalid');
  }
  if (evidence.schemaVersion !== 2) {
    throw new Error('local Artist Detail timing batch evidence schemaVersion is invalid');
  }
  assertIsoTimestamp(evidence.capturedAt, 'local Artist Detail timing batch evidence capturedAt');
  assertSampleCount(evidence.sampleCount, 'local Artist Detail timing batch evidence sampleCount');

  const normalizedSamples = normalizeSamples(evidence.samples);
  if (normalizedSamples.length !== evidence.sampleCount) {
    throw new Error('local Artist Detail timing batch evidence sampleCount does not match samples');
  }
  if (typeof evidence.outcomeIsConsistent !== 'boolean') {
    throw new Error('local Artist Detail timing batch evidence outcomeIsConsistent is invalid');
  }
  if (!Array.isArray(evidence.endpointTimings)) {
    throw new Error('local Artist Detail timing batch evidence endpointTimings must be an array');
  }

  const normalizedEndpointTimings = evidence.endpointTimings.map((entry) => normalizeEndpointTiming(entry, evidence.sampleCount));
  if (new Set(normalizedEndpointTimings.map(({ endpoint }) => endpoint)).size !== normalizedEndpointTimings.length) {
    throw new Error('local Artist Detail timing batch evidence endpointTimings must not repeat an endpoint');
  }

  const expectedEvidence = createArtistDetailLocalTimingBatchEvidence({
    capturedAt: evidence.capturedAt,
    samples: normalizedSamples,
  });
  if (!isDeepStrictEqual({
    endpointTimings: normalizedEndpointTimings,
    outcomeCounts: normalizeOutcomeCounts(evidence.outcomeCounts, evidence.sampleCount),
    outcomeIsConsistent: evidence.outcomeIsConsistent,
    presentation: normalizePresentationSummary(evidence.presentation, evidence.sampleCount),
  }, {
    endpointTimings: expectedEvidence.endpointTimings,
    outcomeCounts: expectedEvidence.outcomeCounts,
    outcomeIsConsistent: expectedEvidence.outcomeIsConsistent,
    presentation: expectedEvidence.presentation,
  })) {
    throw new Error('local Artist Detail timing batch evidence summary does not match samples');
  }

  return expectedEvidence;
}

/**
 * Accepts either a legacy single-sample artifact or the bounded batch format
 * before a local evidence file is written.
 */
export function assertArtistDetailLocalTimingArtifactContract(evidence) {
  if (evidence && typeof evidence === 'object' && !Array.isArray(evidence)
    && Object.hasOwn(evidence, 'artifactType')) {
    return assertArtistDetailLocalTimingBatchEvidenceContract(evidence);
  }

  return assertArtistDetailLocalTimingEvidenceContract(evidence);
}
