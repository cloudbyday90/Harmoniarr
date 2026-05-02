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

function toDate(value, label) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError(`${label} must be a valid date`);
  }

  return date;
}

function toNextRetryAt(now, retryAfterMs) {
  if (!Number.isFinite(retryAfterMs) || retryAfterMs <= 0) {
    return null;
  }

  return new Date(now.getTime() + retryAfterMs).toISOString();
}

function buildPausedResult({
  code = null,
  message,
  nextRetryAt = null,
  provider = 'musicbrainz',
}) {
  return {
    allowed: false,
    pauseCode: code,
    pauseMessage: message,
    nextRetryAt,
    provider,
  };
}

export function createMetadataRefreshDispatchPolicyService({
  nowFn = () => new Date(),
} = {}) {
  function resolveDispatchReadiness({ dependencyStatuses = [], now = nowFn() } = {}) {
    const observedAt = toDate(now, 'now');
    const musicBrainzStatus = dependencyStatuses.find((status) => status?.provider === 'musicbrainz');

    if (!musicBrainzStatus) {
      return { allowed: true };
    }

    if (musicBrainzStatus.status === 'misconfigured') {
      return buildPausedResult({
        code: musicBrainzStatus.code ?? 'musicbrainz_misconfigured',
        message: musicBrainzStatus.message ?? 'MusicBrainz is misconfigured',
      });
    }

    if (musicBrainzStatus.status === 'unavailable') {
      return buildPausedResult({
        code: musicBrainzStatus.code ?? 'musicbrainz_unavailable',
        message: musicBrainzStatus.message ?? 'MusicBrainz is temporarily unavailable',
        nextRetryAt: toNextRetryAt(observedAt, musicBrainzStatus.details?.retryAfterMs),
      });
    }

    if (musicBrainzStatus.status === 'degraded' && (
      musicBrainzStatus.details?.throttled === true
      || musicBrainzStatus.code === 'musicbrainz_unavailable'
    )) {
      return buildPausedResult({
        code: musicBrainzStatus.code ?? 'musicbrainz_rate_limited',
        message: musicBrainzStatus.message ?? 'MusicBrainz is rate limiting requests',
        nextRetryAt: toNextRetryAt(observedAt, musicBrainzStatus.details?.retryAfterMs),
      });
    }

    return { allowed: true };
  }

  return {
    resolveDispatchReadiness,
  };
}