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
 * Discover-screen presentation helpers.
 *
 * Pure functions that produce UI copy, aria labels, and CSS-style objects for
 * DiscoverView. Kept framework-free so they can be unit tested without Vue.
 *
 * Avatar helpers wrap `getArtistAvatar` and re-shape its output to the formats
 * consumed by the template: a CSS style object and a single initial character.
 */

import { getArtistAvatar } from './artist-avatar.js';

// ── Page-level copy ──────────────────────────────────────────────────────────

/**
 * Subtitle shown in the Discover page header.
 *
 * @returns {string}
 */
export function buildDiscoverPageSubtitle() {
  return 'Follow artists you love and Harmoniarr will track their new releases automatically.';
}

// ── Pre-search empty state ───────────────────────────────────────────────────

/**
 * Body text for the pre-search empty state (no query submitted yet).
 *
 * @returns {string}
 */
export function buildDiscoverPreSearchBody() {
  return 'Follow an artist and Harmoniarr will automatically watch for their new releases — ready for you to request.';
}

// ── Search error ─────────────────────────────────────────────────────────────

/**
 * Normalize a raw search error string into a user-facing title.
 *
 * Maps known service-specific messages (e.g. those mentioning MusicBrainz) to
 * plain language that does not expose internal service names. Unknown messages
 * are passed through unchanged.
 *
 * @param {string|null|undefined} rawError - Error string from the search composable.
 * @returns {string}
 */
export function formatDiscoverSearchError(rawError) {
  if (!rawError) return 'Artist search failed. Try again.';
  if (rawError.toLowerCase().includes('musicbrainz')) {
    return 'Artist search is temporarily unavailable. Try again in a moment.';
  }
  return rawError;
}

/**
 * Body text to accompany the search error empty state.
 *
 * @returns {string}
 */
export function buildDiscoverSearchErrorBody() {
  return 'Try again or search for a different artist.';
}

// ── Taste graph ──────────────────────────────────────────────────────────────

/**
 * Subtitle for the taste graph section.
 *
 * @returns {string}
 */
export function buildDiscoverGraphSubtitle() {
  return "Based on artists you follow";
}

/**
 * Aria label for the seeds chip list.
 *
 * @returns {string}
 */
export function buildDiscoverSeedsAriaLabel() {
  return 'Artists you follow';
}

/**
 * Aria label for a seed chip's remove button.
 *
 * @param {string|null|undefined} name - Artist name.
 * @returns {string}
 */
export function buildDiscoverSeedRemoveAriaLabel(name) {
  if (!name) return 'Stop following this artist';
  return `Stop following ${name}`;
}

/**
 * Text shown when the taste graph has seeds but no suggestions were returned.
 *
 * @returns {string}
 */
export function buildDiscoverNoSimilarArtistsMessage() {
  return 'No similar artists found based on your current selection.';
}

// ── Artist avatar ────────────────────────────────────────────────────────────

/**
 * CSS style object for an artist avatar element.
 *
 * Maps the `bg`/`fg` fields from `getArtistAvatar` to `background`/`color`
 * property names expected by Vue's `:style` binding.
 *
 * @param {string|null} id   - MusicBrainz artist ID.
 * @param {string|null} name - Artist name.
 * @returns {{ background: string, color: string }}
 */
export function buildDiscoverAvatarStyle(id, name) {
  const avatar = getArtistAvatar(id, name);
  return { background: avatar.bg, color: avatar.fg };
}

/**
 * Single uppercase initial character for an artist avatar.
 *
 * @param {string|null} id   - MusicBrainz artist ID.
 * @param {string|null} name - Artist name.
 * @returns {string}
 */
export function buildDiscoverArtistInitial(id, name) {
  return getArtistAvatar(id, name).initial;
}
