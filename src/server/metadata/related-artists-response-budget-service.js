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

export const relatedArtistsResponseBudgetDefaults = Object.freeze({
  maxMusicBrainzFallbackSearchQueries: 1,
  maxRadioCandidatesToRerank: 0,
  responseBudgetMs: 6_000,
});

function normalizePositiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive safe integer`);
  }

  return value;
}

function normalizeNonNegativeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }

  return value;
}

function assertAbortSignal(signal) {
  if (
    signal == null
    || typeof signal !== 'object'
    || typeof signal.aborted !== 'boolean'
    || typeof signal.addEventListener !== 'function'
  ) {
    throw new Error('related artists response budget must create an AbortSignal');
  }

  return signal;
}

/**
 * Bounds only one interactive related-artists refresh. It is intentionally not
 * a process-global limiter: provider clients retain their own shared rate
 * queues, while this service keeps one browser-facing operation responsive.
 */
export function createRelatedArtistsResponseBudgetService({
  createTimeoutSignal = AbortSignal.timeout,
  maxMusicBrainzFallbackSearchQueries = relatedArtistsResponseBudgetDefaults.maxMusicBrainzFallbackSearchQueries,
  maxRadioCandidatesToRerank = relatedArtistsResponseBudgetDefaults.maxRadioCandidatesToRerank,
  responseBudgetMs = relatedArtistsResponseBudgetDefaults.responseBudgetMs,
} = {}) {
  const normalizedResponseBudgetMs = normalizePositiveInteger(responseBudgetMs, 'responseBudgetMs');
  const normalizedMaxMusicBrainzFallbackSearchQueries = normalizePositiveInteger(
    maxMusicBrainzFallbackSearchQueries,
    'maxMusicBrainzFallbackSearchQueries',
  );
  const normalizedMaxRadioCandidatesToRerank = normalizeNonNegativeInteger(
    maxRadioCandidatesToRerank,
    'maxRadioCandidatesToRerank',
  );

  function createResponseBudget() {
    const signal = assertAbortSignal(createTimeoutSignal(normalizedResponseBudgetMs));

    return {
      fallbackLimits: {
        maxMusicBrainzFallbackSearchQueries: normalizedMaxMusicBrainzFallbackSearchQueries,
        maxRadioCandidatesToRerank: normalizedMaxRadioCandidatesToRerank,
      },
      isExhausted: () => signal.aborted,
      signal,
    };
  }

  return {
    createResponseBudget,
  };
}
