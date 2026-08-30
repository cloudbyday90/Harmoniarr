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

import { assertArtistDetailPresentationEvidenceContract } from './artist-detail-local-presentation-evidence.js';

const endpointValues = new Set(['discography', 'local_metadata', 'operator_projection']);
const outcomeValues = new Set([
  'local_projection',
  'provider_fallback_after_local_lookup',
  'provider_fallback_after_operator_projection',
]);
const statusFamilyValues = new Set(['2xx', '3xx', '4xx', '5xx']);
const maximumTimingMs = 3_600_000;

function assertObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function assertOnlyAllowedFields(value, allowedFields, label) {
  assertObject(value, label);

  for (const field of Object.keys(value)) {
    if (!allowedFields.has(field)) {
      throw new Error(`${label}.${field} is not allowed in local Artist Detail timing evidence`);
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

function assertAllowedValue(value, allowedValues, label) {
  if (!allowedValues.has(value)) {
    throw new Error(`${label} is invalid`);
  }
}

function normalizeDuration(value, label) {
  if (!Number.isFinite(value) || value < 0 || value > maximumTimingMs) {
    throw new Error(`${label} must be a bounded non-negative duration`);
  }

  return Math.round(value);
}

function normalizeTiming(timing) {
  assertOnlyAllowedFields(timing, new Set([
    'clientRequestDurationMs',
    'responseEndMs',
    'startTimeMs',
  ]), 'local Artist Detail timing evidence request.timing');

  const clientRequestDurationMs = normalizeDuration(
    timing.clientRequestDurationMs,
    'local Artist Detail timing evidence client request duration',
  );
  const responseEndMs = normalizeDuration(
    timing.responseEndMs,
    'local Artist Detail timing evidence response end',
  );
  const startTimeMs = normalizeDuration(
    timing.startTimeMs,
    'local Artist Detail timing evidence start time',
  );

  if (responseEndMs < startTimeMs) {
    throw new Error('local Artist Detail timing evidence response end precedes start time');
  }

  return Object.freeze({
    clientRequestDurationMs,
    responseEndMs,
    startTimeMs,
  });
}

function normalizeRequest(request) {
  assertOnlyAllowedFields(request, new Set(['endpoint', 'statusFamily', 'timing']), 'local Artist Detail timing evidence request');
  assertAllowedValue(request.endpoint, endpointValues, 'local Artist Detail timing evidence endpoint');
  assertAllowedValue(request.statusFamily, statusFamilyValues, 'local Artist Detail timing evidence status family');

  return Object.freeze({
    endpoint: request.endpoint,
    statusFamily: request.statusFamily,
    timing: normalizeTiming(request.timing),
  });
}

function getExpectedEndpointOrder(outcome) {
  switch (outcome) {
    case 'local_projection':
      return ['local_metadata', 'operator_projection'];
    case 'provider_fallback_after_local_lookup':
      return ['local_metadata', 'discography'];
    case 'provider_fallback_after_operator_projection':
      return ['local_metadata', 'operator_projection', 'discography'];
    default:
      throw new Error('local Artist Detail timing evidence outcome is invalid');
  }
}

/**
 * Converts a response status to a deliberately low-cardinality health value.
 * Exact status codes are not retained in local timing evidence.
 *
 * @param {number} status
 * @returns {'2xx' | '3xx' | '4xx' | '5xx'}
 */
export function getArtistDetailTimingStatusFamily(status) {
  if (!Number.isInteger(status) || status < 200 || status > 599) {
    throw new Error('Artist Detail response status is invalid');
  }

  return `${Math.floor(status / 100)}xx`;
}

/**
 * Creates a bounded timing record for a request observed in a real browser.
 * It accepts only fixed endpoint names and never retains URLs, IDs, headers,
 * payloads, user information, or session data.
 *
 * @param {{ endpoint: string, status: number, timing: { duration: number, responseEnd: number, startTime: number } }} input
 */
export function createArtistDetailTimingRequest({ endpoint, status, timing } = {}) {
  return normalizeRequest({
    endpoint,
    statusFamily: getArtistDetailTimingStatusFamily(status),
    timing: {
      clientRequestDurationMs: timing?.duration,
      responseEndMs: timing?.responseEnd,
      startTimeMs: timing?.startTime,
    },
  });
}

/**
 * Creates the local-deployment evidence artifact. The request order is part
 * of the contract: it shows whether the current artist used the local
 * projection or a provider Discography fallback without disclosing why.
 *
 * @param {{ capturedAt?: string, outcome: string, presentation: object, requests: object[] }} input
 */
export function createArtistDetailLocalTimingEvidence({
  capturedAt = new Date().toISOString(),
  outcome,
  presentation,
  requests,
} = {}) {
  assertIsoTimestamp(capturedAt, 'local Artist Detail timing evidence capturedAt');
  assertAllowedValue(outcome, outcomeValues, 'local Artist Detail timing evidence outcome');

  if (!Array.isArray(requests)) {
    throw new Error('local Artist Detail timing evidence requests must be an array');
  }

  const normalizedRequests = requests.map(normalizeRequest);
  const expectedEndpointOrder = getExpectedEndpointOrder(outcome);
  const endpoints = normalizedRequests.map(({ endpoint }) => endpoint);

  if (JSON.stringify(endpoints) !== JSON.stringify(expectedEndpointOrder)) {
    throw new Error('local Artist Detail timing evidence requests do not match the outcome');
  }

  const normalizedPresentation = assertArtistDetailPresentationEvidenceContract(presentation);

  return Object.freeze({
    capturedAt,
    outcome,
    presentation: normalizedPresentation,
    requests: Object.freeze(normalizedRequests),
    schemaVersion: 2,
  });
}

/**
 * Revalidates an artifact before it is persisted. This keeps callers from
 * using the writer as a side channel for fields that the safe schema omits.
 *
 * @param {object} evidence
 */
export function assertArtistDetailLocalTimingEvidenceContract(evidence) {
  assertOnlyAllowedFields(evidence, new Set([
    'capturedAt',
    'outcome',
    'presentation',
    'requests',
    'schemaVersion',
  ]), 'local Artist Detail timing evidence');

  if (evidence.schemaVersion !== 2) {
    throw new Error('local Artist Detail timing evidence schemaVersion is invalid');
  }

  return createArtistDetailLocalTimingEvidence(evidence);
}
