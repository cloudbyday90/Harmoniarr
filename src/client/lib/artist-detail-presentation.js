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
 * Artist-detail screen presentation helpers.
 *
 * Pure functions that produce UI copy, metadata strings, URLs, and CSS-style
 * objects for ArtistDetailView. Kept framework-free for unit testing without
 * Vue dependencies.
 *
 * Avatar helpers delegate to the shared `buildAvatarStyle` / `buildAvatarInitial`
 * exports from `artist-avatar.js` — the canonical implementations live there.
 */

import { buildAvatarInitial, buildAvatarStyle } from './artist-avatar.js';

// ── Artist header ─────────────────────────────────────────────────────────────

/**
 * Short metadata line displayed under the artist name.
 *
 * Assembles up to three optional fields — type, country, and disambiguation —
 * joined by a middle-dot separator. Returns null when no fields are present.
 *
 * @param {{ type?: string|null, country?: string|null, disambiguation?: string|null }|null|undefined} artist
 * @returns {string|null}
 */
export function buildArtistMetaLine(artist) {
  if (!artist) return null;
  const parts = [];
  if (artist.type) parts.push(artist.type);
  if (artist.country) parts.push(artist.country);
  if (artist.disambiguation) parts.push(`(${artist.disambiguation})`);
  return parts.length ? parts.join(' · ') : null;
}

/**
 * External link URL for the artist on MusicBrainz, or null when no MBID is
 * available.
 *
 * @param {string|null|undefined} mbid - MusicBrainz artist ID.
 * @returns {string|null}
 */
export function buildArtistMusicBrainzUrl(mbid) {
  if (!mbid) return null;
  return `https://musicbrainz.org/artist/${mbid}`;
}

/**
 * Label for the external MusicBrainz link button.
 *
 * @returns {string}
 */
export function buildArtistMusicBrainzLabel() {
  return 'More info ↗';
}

/**
 * Background-image style object for the artist hero stage.
 *
 * @param {string|null|undefined} artworkUrl
 * @returns {{ backgroundImage?: string }}
 */
export function buildArtistHeroBackgroundStyle(artworkUrl) {
  if (!artworkUrl) {
    return {};
  }

  return {
    backgroundImage: `linear-gradient(180deg, color-mix(in srgb, var(--hx-bg-canvas) 20%, transparent) 0%, color-mix(in srgb, var(--hx-bg-canvas) 82%, transparent) 62%, var(--hx-bg-canvas) 100%), url(${artworkUrl})`,
  };
}

// ── Errors ────────────────────────────────────────────────────────────────────

/**
 * Body text for the hard-error EmptyState shown when the discography fails to
 * load and no artist name fallback is available.
 *
 * @returns {string}
 */
export function buildArtistDetailErrorBody() {
  return 'Check your connection and try again.';
}

/**
 * Normalize a raw discography API error string to a user-facing message.
 *
 * Suppresses technical messages (those mentioning MusicBrainz, parameter
 * validation, HTTP status codes) in favour of plain language. Unknown messages
 * are passed through unchanged so genuine user-actionable errors surface.
 *
 * @param {string|null|undefined} rawError
 * @returns {string}
 */
export function formatDiscographyError(rawError) {
  if (!rawError) return 'Discography could not be loaded. Try refreshing the page.';
  const lower = rawError.toLowerCase();
  if (lower.includes('musicbrainz')) {
    return 'Discography is temporarily unavailable. Try again in a moment.';
  }
  // Suppress parameter-validation errors from the API (e.g. "limit must be an integer between 1 and 25")
  if (lower.includes('must be') || lower.includes('invalid') || lower.includes('bad request')) {
    return 'Discography could not be loaded. Try refreshing the page.';
  }
  return rawError;
}

/**
 * Normalize a raw artist metadata error string to a user-facing message.
 *
 * @param {string|null|undefined} rawError
 * @returns {string}
 */
export function formatArtistDetailError(rawError) {
  if (!rawError) return 'Some artist details could not be loaded.';
  const lower = rawError.toLowerCase();
  if (lower.includes('musicbrainz')) {
    return 'Artist details are temporarily unavailable.';
  }
  if (lower.includes('must be') || lower.includes('invalid') || lower.includes('bad request')) {
    return 'Some artist details could not be loaded.';
  }
  return rawError;
}

// ── Discography ───────────────────────────────────────────────────────────────

/**
 * Plural heading label for a discography section type.
 *
 * Handles the known MusicBrainz primary types explicitly. Falls back to
 * appending "s" for unknown types.
 *
 * @param {string|null|undefined} type - Release group primary type from MusicBrainz.
 * @returns {string}
 */
export function pluralizeReleaseType(type) {
  if (!type) return 'Releases';
  const known = {
    Album: 'Albums',
    Single: 'Singles',
    EP: 'EPs',
    Broadcast: 'Broadcasts',
    Other: 'Other',
  };
  return known[type] ?? `${type}s`;
}

/**
 * Empty-state body text shown when MusicBrainz lists no release groups for the
 * artist.
 *
 * @returns {string}
 */
export function buildNoDiscographyBody() {
  return 'No releases are listed for this artist yet.';
}

// ── Related artists ───────────────────────────────────────────────────────────

/**
 * CSS style object for a related-artist avatar chip.
 *
 * Delegates to the shared `buildAvatarStyle` helper in `artist-avatar.js`.
 *
 * @param {string|null} id   - MusicBrainz artist ID.
 * @param {string|null} name - Artist display name.
 * @returns {{ background: string, color: string }}
 */
export function buildRelatedArtistAvatarStyle(id, name) {
  return buildAvatarStyle(id, name);
}

/**
 * Single uppercase initial character for a related-artist avatar chip.
 *
 * Delegates to the shared `buildAvatarInitial` helper in `artist-avatar.js`.
 *
 * @param {string|null} id   - MusicBrainz artist ID.
 * @param {string|null} name - Artist display name.
 * @returns {string}
 */
export function buildRelatedArtistInitial(id, name) {
  return buildAvatarInitial(id, name);
}

/**
 * Small label for related-artist similarity strength.
 *
 * @param {number|null|undefined} score
 * @returns {string}
 */
export function formatRelatedArtistScore(score) {
  if (typeof score !== 'number' || Number.isNaN(score) || score <= 0) {
    return 'Related artist';
  }

  return `Similarity ${score.toFixed(2)}`;
}
