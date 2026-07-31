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

const WRITE_ONLY_SECRET_PATHS = new Set([
  'slskd.apiKey',
  'providers.appleMusicPrivateKey',
  'providers.fanartTvApiKey',
  'providers.fanartTvClientKey',
  'providers.spotifyClientSecret',
  'providers.youtubeApiKey',
  'providers.youtubeClientSecret',
]);

function isSecretPath(path) {
  return WRITE_ONLY_SECRET_PATHS.has(path.join('.'));
}

function normalizeFingerprintValue(value, path = []) {
  if (isSecretPath(path)) {
    return typeof value === 'string' && value.trim() ? '[configured]' : '[empty]';
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeFingerprintValue(item, path));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, normalizeFingerprintValue(value[key], [...path, key])]),
    );
  }

  return value ?? null;
}

/**
 * Produces a deterministic dirty-state fingerprint without retaining any
 * write-only secret value in memory beyond the editable form itself.
 *
 * @param {object} form
 * @returns {string}
 */
export function buildSettingsFormFingerprint(form) {
  return JSON.stringify(normalizeFingerprintValue(form));
}
