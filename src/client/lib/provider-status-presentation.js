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

/**
 * Return a human-readable display label for a music provider key.
 *
 * Unknown keys are returned as-is so novel providers still render something.
 *
 * @param {string|null|undefined} provider
 * @returns {string}
 */
export function getProviderLabel(provider) {
  switch (provider) {
    case 'apple_music':
      return 'Apple Music';
    case 'spotify':
      return 'Spotify';
    case 'youtube':
      return 'YouTube';
    default:
      return provider ?? '';
  }
}

/**
 * Return a human-readable status string for an OAuth provider object.
 *
 * @param {object|null|undefined} provider
 * @returns {string}
 */
export function getOAuthProviderStatus(provider) {
  if (!provider) return 'Unavailable';
  return provider.linked ? 'Linked' : 'Not linked';
}

/**
 * Return a CSS class suffix for an OAuth provider status pill.
 *
 * @param {object|null|undefined} provider
 * @returns {string}
 */
export function getOAuthProviderStatusClass(provider) {
  if (!provider) return 'review-status-failed';
  return provider.linked ? 'review-status-selected' : 'review-status-held';
}

/**
 * Return a human-readable status label for an Apple Music (credentials-based)
 * provider object.
 *
 * @param {object|null|undefined} provider
 * @returns {string}
 */
export function getAppleMusicStatusLabel(provider) {
  if (!provider) return 'Unavailable';
  return provider.configured ? 'Configured' : 'Not configured';
}

/**
 * Return a CSS class suffix for an Apple Music provider status pill.
 *
 * @param {object|null|undefined} provider
 * @returns {string}
 */
export function getAppleMusicStatusClass(provider) {
  if (!provider) return 'review-status-failed';
  return provider.configured ? 'review-status-selected' : 'review-status-held';
}

/**
 * Format the token expiry timestamp for a linked OAuth provider.
 *
 * Returns null when the provider is absent, not linked, or has no expiry value
 * so the caller can conditionally render the field.
 *
 * @param {object|null|undefined} provider
 * @returns {string|null}
 */
export function formatTokenExpiry(provider) {
  if (!provider?.linked || !provider.tokenExpiresAt) return null;
  return new Date(provider.tokenExpiresAt).toLocaleString();
}
