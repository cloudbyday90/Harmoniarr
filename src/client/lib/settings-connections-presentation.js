/*
  Harmoniarr - Soulseek-native music library management
  Copyright (C) 2026 Harmoniarr Contributors

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with this program. If not, see <https://www.gnu.org/licenses/>.
*/

/**
 * Settings — Connections screen presentation helpers.
 *
 * Pure functions only — no Vue, no reactive state, no side-effects.
 * All string literals that appear in the UI live here so they can be
 * tested independently and changed without touching component code.
 */

// ── Soulseek / slskd connection ───────────────────────────────────────────────

/**
 * Subtitle copy for the Soulseek connection settings card.
 * Must not expose the internal service name "slskd" or the word "daemon".
 *
 * @returns {string}
 */
export function buildSlskdConnectionSubtitle() {
  return 'Choose whether Harmoniarr manages Soulseek, connects to your existing service, or keeps downloads off.';
}

export function formatSlskdProviderModeLabel(slskdStatus) {
  switch (slskdStatus?.providerMode) {
    case 'managed':
      return 'Managed';
    case 'disabled':
      return 'Downloads off';
    case 'external':
    default:
      return 'External';
  }
}

/**
 * Returns a display label describing the configured state of the slskd API key.
 *
 * @param {object|null|undefined} slskdStatus - The `secretStatus.slskd` object.
 * @param {boolean} [slskdStatus.apiKeyConfigured]
 * @param {'managed_file'|'stored'|'environment'|string} [slskdStatus.apiKeySource]
 * @returns {string}
 */
export function formatSlskdApiKeyStatusLabel(slskdStatus) {
  if (!slskdStatus?.apiKeyConfigured) return 'No API key configured';
  if (slskdStatus.apiKeySource === 'stored') {
    return 'Stored in Harmoniarr';
  }

  if (slskdStatus.apiKeySource === 'managed_file') {
    return 'Managed deployment key';
  }

  return 'Environment-provided key';
}

// ── Provider secret status ────────────────────────────────────────────────────

/**
 * Returns a display label describing the configured state of a streaming
 * provider secret (client secret, API key, or private key).
 *
 * @param {object|null|undefined} providerStatus - The provider entry from `secretStatus.providers`.
 * @param {string} secretKey - The property name to check for a configured secret (e.g. `'clientSecretConfigured'`).
 * @param {string} sourceKey - The property name indicating where the secret is stored (e.g. `'clientSecretSource'`).
 * @returns {string}
 */
export function formatProviderSecretStatusLabel(providerStatus, secretKey, sourceKey) {
  if (!providerStatus?.[secretKey]) return 'No secret configured';
  return providerStatus[sourceKey] === 'stored'
    ? 'Stored in Harmoniarr'
    : 'Environment-provided secret';
}

// ── OAuth status ──────────────────────────────────────────────────────────────

/**
 * Returns a display label describing the OAuth authorization state for a
 * streaming provider (Spotify, YouTube, etc.).
 *
 * - Not linked → `'Not linked'`
 * - Linked with an expiry → `'Linked until <localised date/time>'`
 * - Linked without an expiry → `'Linked'`
 *
 * @param {object|null|undefined} oauthStatus - The provider OAuth status object.
 * @param {boolean} [oauthStatus.linked]
 * @param {string|null|undefined} [oauthStatus.tokenExpiresAt] - ISO 8601 timestamp.
 * @returns {string}
 */
export function formatOAuthStatusLabel(oauthStatus) {
  if (!oauthStatus?.linked) return 'Not linked';
  if (oauthStatus.tokenExpiresAt) {
    return `Linked until ${new Date(oauthStatus.tokenExpiresAt).toLocaleString()}`;
  }
  return 'Linked';
}

const PROVIDER_LABELS = {
  media_tooling: 'Media tooling',
  musicbrainz: 'MusicBrainz',
  slskd: 'Soulseek (slskd)',
};

export function formatDependencyProviderLabel(provider) {
  return PROVIDER_LABELS[provider] ?? provider;
}

const STATUS_LABELS = {
  degraded: 'Degraded',
  disabled: 'Disabled',
  healthy: 'Healthy',
  misconfigured: 'Misconfigured',
  rate_limited: 'Rate limited',
  unavailable: 'Unavailable',
  unknown: 'Unknown',
};

export function formatDependencyStatusLabel(status) {
  return STATUS_LABELS[status] ?? status ?? 'Unknown';
}

export function getDependencyStatusClass(status) {
  switch (status) {
    case 'healthy':
      return 'review-status-selected';
    case 'degraded':
    case 'disabled':
    case 'rate_limited':
      return 'review-status-held';
    case 'unavailable':
    case 'misconfigured':
      return 'review-status-failed';
    default:
      return '';
  }
}
