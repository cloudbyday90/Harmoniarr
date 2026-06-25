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
 * Pure screen-reader status message for the Discover typeahead.
 *
 * Returns the text a `role="status"` / `aria-live="polite"` region should
 * announce. To avoid per-keystroke spam, it announces ONLY completed searches:
 * it returns an empty string while a search is in flight (or before any search),
 * so the live region stays quiet mid-type and speaks once when results settle.
 * Pluralisation ("1 artist" vs "N artists") is handled here so the wording is
 * unit-tested and consistent.
 *
 * @param {object} input
 * @param {number} [input.count=0] - Number of results from the completed search.
 * @param {boolean} [input.isSearching=false] - Whether a search is in flight.
 * @param {boolean} [input.hasSearched=false] - Whether any search has run.
 * @param {string} [input.searchError=''] - A user-facing error message, if any.
 * @returns {string} The message to announce (empty when there is nothing to say).
 */
export function buildSearchStatusMessage({
  count = 0,
  isSearching = false,
  hasSearched = false,
  searchError = '',
} = {}) {
  if (typeof searchError === 'string' && searchError.length > 0) {
    return searchError;
  }
  // Quiet while a search is in flight or before the first search has run, so the
  // region announces only on completion (avoids typeahead spam).
  if (isSearching === true || hasSearched !== true) {
    return '';
  }
  const total = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  if (total === 0) {
    return 'No artists found';
  }
  if (total === 1) {
    return '1 artist found';
  }
  return `${total} artists found`;
}
