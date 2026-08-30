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

export const artistDetailPresentationStates = Object.freeze([
  'ready',
  'still_loading',
  'unavailable',
]);

const presentationStateValues = new Set(artistDetailPresentationStates);
const maximumPresentationObservationMs = 3_600_000;

function assertObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function assertOnlyAllowedFields(value, allowedFields, label) {
  assertObject(value, label);

  for (const field of Object.keys(value)) {
    if (!allowedFields.has(field)) {
      throw new Error(`${label}.${field} is not allowed in local Artist Detail presentation evidence`);
    }
  }
}

function normalizeObservedAtMs(value) {
  if (!Number.isFinite(value) || value < 0 || value > maximumPresentationObservationMs) {
    throw new Error('local Artist Detail presentation observation time must be a bounded non-negative duration');
  }

  return Math.round(value);
}

/**
 * Creates a deliberately low-cardinality observation of the Artist Detail
 * presentation state. It never accepts page text, IDs, URLs, error content,
 * account data, or an absolute time.
 *
 * @param {{ observedAtMs: number, state: 'ready' | 'still_loading' | 'unavailable' }} input
 */
export function createArtistDetailPresentationEvidence({ observedAtMs, state } = {}) {
  if (!presentationStateValues.has(state)) {
    throw new Error('local Artist Detail presentation state is invalid');
  }

  return Object.freeze({
    observedAtMs: normalizeObservedAtMs(observedAtMs),
    state,
  });
}

/**
 * Revalidates presentation evidence before it can be included in a local
 * timing artifact. The strict schema prevents this signal from becoming a
 * DOM-data side channel.
 *
 * @param {object} evidence
 */
export function assertArtistDetailPresentationEvidenceContract(evidence) {
  assertOnlyAllowedFields(evidence, new Set(['observedAtMs', 'state']), 'local Artist Detail presentation evidence');
  return createArtistDetailPresentationEvidence(evidence);
}
