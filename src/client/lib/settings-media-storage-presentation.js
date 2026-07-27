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
 * Maps a path validation status value to a design-system tone token.
 *
 * @param {string|null|undefined} status
 * @returns {'success'|'danger'|'warning'}
 */
export function formatPathStatusTone(status) {
  switch (status) {
    case 'healthy': return 'success';
    case 'unavailable': return 'danger';
    default: return 'warning';
  }
}

/**
 * Maps a path validation status value to a human-readable display label.
 *
 * @param {string|null|undefined} status
 * @returns {string}
 */
export function formatPathStatusLabel(status) {
  switch (status) {
    case 'healthy': return 'Healthy';
    case 'unavailable': return 'Unavailable';
    default: return 'Needs attention';
  }
}

/**
 * Converts an array to a comma-separated string. Returns an empty string for
 * non-array inputs so the function is safe to use with raw API values.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function formatCommaSeparatedList(value) {
  return Array.isArray(value) ? value.join(', ') : '';
}

/**
 * Returns a 1-based display label for a download path mapping by its
 * 0-based index. Used in the path validation card to identify each mapping.
 *
 * @param {number} index - 0-based mapping index
 * @returns {string} e.g. "Mapping 1"
 */
export function formatMappingLabel(index) {
  return `Mapping ${Number(index) + 1}`;
}

/**
 * Returns a 1-based display label for a per-user library folder by its
 * 0-based index. Uses "folder" rather than "root" to match admin vocabulary.
 *
 * @param {number} index - 0-based index
 * @returns {string} e.g. "Per-user folder 1"
 */
export function formatUserRootLabel(index) {
  return `Per-user folder ${Number(index) + 1}`;
}

/**
 * Normalises raw backend path-validation notes before display. Replaces
 * internal service names and terminology with operator-friendly language.
 * Returns null for falsy inputs so callers can use a v-if guard.
 *
 * @param {string|null|undefined} note
 * @returns {string|null}
 */
export function formatPathValidationNote(note) {
  if (!note || typeof note !== 'string') return null;

  // Known pattern: informational note about missing download mappings.
  // The raw message references internal service names and implementation terms.
  if (/no explicit .* download mappings/i.test(note)) {
    return 'No path translations are configured. Harmoniarr will use the downloads folder path directly.';
  }

  // Fallback: strip the internal service name for any other notes.
  return note.replace(/\bslskd\b/gi, 'your download client');
}

/**
 * Returns the hint text for the Downloads folder field. Uses
 * "download client" rather than the internal service name "slskd".
 *
 * @returns {string}
 */
export function buildDownloadsPathHint() {
  return 'Where your download client puts completed downloads. Harmoniarr reads from here.';
}

/**
 * Returns the description for the Path translations section. Uses
 * plain language instead of container-centric framing.
 *
 * @returns {string}
 */
export function buildPathTranslationsDescription() {
  return 'If your download client and Harmoniarr use different paths for the same folder, add a translation here.';
}

/**
 * Returns the empty-state copy for the Path translations list. Uses
 * "download client" rather than the internal service name "slskd".
 *
 * @returns {string}
 */
export function buildPathTranslationsEmptyState() {
  return 'Not needed if your download client and Harmoniarr share the same folder paths.';
}

/**
 * Builds the setup prompt shown when an enabled download provider has no
 * explicit path translation. Automatic file handling is intentionally gated
 * until the operator confirms both views of the completed-download folder.
 *
 * @param {{ downloadMappingCount?: number, providerMode?: string }=} options
 * @returns {{ actionLabel: string, description: string, title: string }|null}
 */
export function buildPathTranslationSetupPrompt({
  downloadMappingCount = 0,
  providerMode = 'external',
} = {}) {
  if (providerMode === 'disabled' || Number(downloadMappingCount) > 0) {
    return null;
  }

  return {
    actionLabel: 'Add path translation',
    description: 'Make the completed-download folder available to Harmoniarr, then enter the download client path and the Harmoniarr path for that same folder.',
    title: 'Finish automatic download setup',
  };
}

/**
 * Returns the field label for the download client side of a path mapping.
 * Uses "Download client path" rather than "slskd sees this path".
 *
 * @returns {string}
 */
export function buildDownloadMappingSourceLabel() {
  return 'Download client path';
}
