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

export const musicBrainzRequestDefaults = Object.freeze({
  maxRetries: 2,
  minIntervalMs: 1_100,
  requestTimeoutMs: 10_000,
});

export const minimumMusicBrainzRequestIntervalMs = 1_000;

function parseNonNegativeInteger(value, fallback) {
  if (value == null || value === '') {
    return fallback;
  }

  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Expected a non-negative integer but received ${value}`);
  }

  return parsed;
}

function parsePositiveInteger(value, fallback) {
  if (value == null || value === '') {
    return fallback;
  }

  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Expected a positive integer but received ${value}`);
  }

  return parsed;
}

/**
 * Normalizes the provider client settings consumed by both MusicBrainz request
 * execution and dependent operation-level deadline policies.
 */
export function resolveMusicBrainzRequestPolicy({
  maxRetries = process.env.MUSICBRAINZ_MAX_RETRIES,
  minIntervalMs = process.env.MUSICBRAINZ_MIN_INTERVAL_MS,
  requestTimeoutMs = process.env.MUSICBRAINZ_REQUEST_TIMEOUT_MS,
} = {}) {
  return Object.freeze({
    maxRetries: parseNonNegativeInteger(maxRetries, musicBrainzRequestDefaults.maxRetries),
    minIntervalMs: Math.max(
      parsePositiveInteger(minIntervalMs, musicBrainzRequestDefaults.minIntervalMs),
      minimumMusicBrainzRequestIntervalMs,
    ),
    requestTimeoutMs: parsePositiveInteger(
      requestTimeoutMs,
      musicBrainzRequestDefaults.requestTimeoutMs,
    ),
  });
}
