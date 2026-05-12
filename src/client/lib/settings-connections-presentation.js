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
  return 'Configure the address and API key for the Soulseek download service.';
}

/**
 * Returns a display label describing the configured state of the slskd API key.
 *
 * @param {object|null|undefined} slskdStatus - The `secretStatus.slskd` object.
 * @param {boolean} [slskdStatus.apiKeyConfigured]
 * @param {'stored'|'environment'|string} [slskdStatus.apiKeySource]
 * @returns {string}
 */
export function formatSlskdApiKeyStatusLabel(slskdStatus) {
  if (!slskdStatus?.apiKeyConfigured) return 'No API key configured';
  return slskdStatus.apiKeySource === 'stored'
    ? 'Stored in Harmoniarr'
    : 'Environment-provided key';
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
