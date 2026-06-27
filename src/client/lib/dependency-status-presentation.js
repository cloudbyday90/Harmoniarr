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

const dependencyStatusLabels = {
  degraded: 'Degraded',
  disabled: 'Disabled',
  healthy: 'Healthy',
  misconfigured: 'Misconfigured',
  unavailable: 'Unavailable',
};

/**
 * Returns a display label for a dependency provider identifier.
 * Unknown values are passed through unchanged.
 */
export function formatDependencyProvider(provider) {
  if (provider === 'musicbrainz') {
    return 'MusicBrainz';
  }

  if (provider === 'slskd') {
    return 'slskd';
  }

  return provider;
}

/**
 * Returns a display label for a dependency status enum value.
 * Unknown values are passed through unchanged.
 */
export function formatDependencyStatus(status) {
  return dependencyStatusLabels[status] ?? status;
}

/**
 * Converts a camelCase detail key into a human-readable title-cased label.
 * Example: 'responseTimeMs' → 'Response time ms'
 */
export function formatDependencyDetailKey(key) {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (letter) => letter.toUpperCase());
}
