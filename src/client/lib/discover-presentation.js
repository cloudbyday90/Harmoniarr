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

import { buildAvatarInitial, buildAvatarStyle } from './artist-avatar.js';
import { buildRecommendationExplanation } from './discover-recommendation-explainability.js';

// ── Page-level copy ──────────────────────────────────────────────────────────

/**
 * Subtitle shown in the Discover page header.
 *
 * @returns {string}
 */
export function buildDiscoverPageSubtitle() {
  return 'Search for an artist, then add them to your monitored artists to track releases and find similar artists.';
}

// ── Pre-search empty state ───────────────────────────────────────────────────

/**
 * Body text for the pre-search empty state (no query submitted yet).
 *
 * @returns {string}
 */
export function buildDiscoverPreSearchBody() {
  return 'Add an artist you trust and Harmoniarr tracks their future releases and recommends similar artists to monitor.';
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

// ── Search-panel view state ──────────────────────────────────────────────────

/**
 * Resolve the Discover search panel's view mode from the current flags.
 *
 * Replaces a long `v-if / v-else-if` ladder with a single, testable state
 * function. Precedence is significant and intentionally preserved:
 *
 *   1. `'error'`      — a search request failed.
 *   2. `'pre-search'` — nothing searched yet and no monitored artists to show.
 *   3. `'searching'`  — a search request is in flight.
 *   4. `'empty'`      — a search completed with zero results.
 *   5. `'results'`    — a search completed with at least one result.
 *   6. `'idle'`       — no search has run but monitored artists are present, so
 *                       the panel yields to the recommendations section.
 *
 * @param {object} flags
 * @param {string|null|undefined} flags.searchError
 * @param {boolean} flags.hasSearched
 * @param {boolean} flags.isSearching
 * @param {number} flags.resultCount
 * @param {boolean} flags.hasRecommendationInputs
 * @returns {'error'|'pre-search'|'searching'|'empty'|'results'|'idle'}
 */
export function resolveDiscoverSearchPanelMode({
  searchError,
  hasSearched,
  isSearching,
  resultCount,
  hasRecommendationInputs,
}) {
  if (searchError) {
    return 'error';
  }
  if (!hasSearched && !hasRecommendationInputs) {
    return 'pre-search';
  }
  if (isSearching) {
    return 'searching';
  }
  if (hasSearched && resultCount === 0) {
    return 'empty';
  }
  if (hasSearched && resultCount > 0) {
    return 'results';
  }
  return 'idle';
}

// ── Recommendations ──────────────────────────────────────────────────────────

/**
 * Subtitle for the recommended-artists section.
 *
 * @returns {string}
 */
export function buildDiscoverRecommendationsSubtitle() {
  return 'Based on your monitored artists';
}

/**
 * Aria label for the monitored-artist navigation list.
 *
 * @returns {string}
 */
export function buildDiscoverMonitoredArtistsAriaLabel() {
  return 'Your monitored artists';
}

/**
 * Aria label for a monitored-artist chip that navigates to the artist detail
 * page. The chip is a navigation link, not a destructive control.
 *
 * @param {string|null|undefined} name - Artist name.
 * @returns {string}
 */
export function buildDiscoverMonitoredArtistNavAriaLabel(name) {
  if (!name) return 'View this monitored artist';
  return `View ${name}`;
}

/**
 * Helper copy for the monitored-artist band, pointing users to the detail page
 * where monitoring is managed (Discover does not manage monitoring state).
 *
 * @returns {string}
 */
export function buildDiscoverMonitoredBandCopy() {
  return 'Open an artist to manage their policy and tracked releases.';
}

/**
 * Helper copy describing how recommendations are ranked.
 *
 * @returns {string}
 */
export function buildDiscoverSuggestionsCopy() {
  return 'Ranked by similarity strength first, then by shared support from your monitored artists.';
}

/**
 * Text shown when monitored artists exist but no recommendations were returned.
 *
 * @returns {string}
 */
export function buildDiscoverNoSimilarArtistsMessage() {
  return 'No recommendations yet. Add more monitored artists to widen the field.';
}

/**
 * Label for the temporary recommendation focus controls.
 *
 * @returns {string}
 */
export function buildDiscoverRecommendationFocusLegend() {
  return 'Narrow recommendations';
}

/**
 * Helper copy for recommendation focus controls.
 *
 * @returns {string}
 */
export function buildDiscoverRecommendationFocusCopy() {
  return 'Choose monitored artists for this view only. Leave all unchecked to use every monitored artist.';
}

/**
 * Accessible label for an individual recommendation focus checkbox.
 *
 * @param {string|null|undefined} name - Artist name.
 * @returns {string}
 */
export function buildDiscoverRecommendationFocusOptionLabel(name) {
  if (!name) {
    return 'Focus recommendations on this monitored artist';
  }
  return `Focus recommendations on ${name}`;
}

/**
 * Short status text for the active recommendation focus.
 *
 * @param {object} counts
 * @param {number} [counts.activeCount]
 * @param {number} [counts.totalCount]
 * @returns {string}
 */
export function buildDiscoverRecommendationFocusSummary({
  activeCount = 0,
  totalCount = 0,
} = {}) {
  if (activeCount === 1) {
    return 'Focused on 1 monitored artist.';
  }
  if (activeCount > 1) {
    return `Focused on ${activeCount} monitored artists.`;
  }
  if (totalCount === 1) {
    return 'Using 1 monitored artist.';
  }
  return `Using all ${totalCount} monitored artists.`;
}

// ── Recommendation cards ─────────────────────────────────────────────────────

/**
 * Provenance badge (label + tone) for a recommended artist card.
 *
 * Aggregates the engine sources that contributed an artist into a single,
 * explainable badge so operators understand *why* an artist was recommended.
 * The label is drawn from a fixed enumeration — no engine or user string is
 * ever rendered as the badge — which keeps the badge injection-free.
 *
 * @param {{ sources?: string[] }|null|undefined} suggestion
 * @returns {{ label: string, tone: string }}
 */
export function buildRecommendationProvenance(suggestion) {
  const { provenance } = buildRecommendationExplanation(suggestion);
  return { label: provenance.label, tone: provenance.tone };
}

/**
 * Overlap-strength disclosure for a recommended artist card.
 *
 * Surfaces *how strong* a recommendation is — progressive disclosure on top of
 * the provenance badge, which only says *why* an artist surfaced. The engine's
 * raw `rankScore` is intentionally bucketed into a small fixed enumeration of
 * tiers rather than rendered directly, so internal scoring semantics stay
 * private and the label can never carry engine- or user-supplied markup.
 *
 * Tiers (by ranked overlap score, which already folds in the multi-input boost):
 *   - `>= 1.5` → `strong`   ("Strong overlap")
 *   - `>= 0.8` → `moderate` ("Moderate overlap")
 *   - else     → `emerging` ("Emerging overlap")
 *
 * @param {{ rankScore?: number, score?: number }|null|undefined} suggestion
 * @returns {{ tier: 'strong'|'moderate'|'emerging', label: string }}
 */
export function buildRecommendationStrength(suggestion) {
  return buildRecommendationExplanation(suggestion).strength;
}

/**
 * Meta line for a recommended artist card.
 *
 * @param {{ inputCount?: number }|null|undefined} suggestion
 * @returns {string}
 */
export function buildRecommendationMeta(suggestion) {
  if (!suggestion) {
    return '';
  }
  return buildRecommendationExplanation(suggestion).metaText;
}

/**
 * Supporting line for a recommended artist card.
 *
 * @param {{ score?: number }|null|undefined} suggestion
 * @returns {string}
 */
export function buildRecommendationSupport(suggestion) {
  if (!suggestion) {
    return '';
  }
  return buildRecommendationExplanation(suggestion).supportingText;
}

export { buildRecommendationExplanation };

// ── Search result cards ──────────────────────────────────────────────────────

/**
 * Badge label for a search-result artist card.
 *
 * @param {boolean} isAdded - Whether the artist is already monitored.
 * @returns {string}
 */
export function buildSearchResultBadgeLabel(isAdded) {
  return isAdded ? 'Monitored' : 'Search match';
}

/**
 * Badge tone for a search-result artist card.
 *
 * @param {boolean} isAdded - Whether the artist is already monitored.
 * @returns {string}
 */
export function buildSearchResultBadgeTone(isAdded) {
  return isAdded ? 'success' : 'info';
}

/**
 * Meta line for a search-result artist card (type and country).
 *
 * @param {{ type?: string, country?: string }|null|undefined} artist
 * @returns {string}
 */
export function buildSearchResultMeta(artist) {
  const parts = [];
  if (artist?.type) {
    parts.push(artist.type);
  }
  if (artist?.country) {
    parts.push(artist.country);
  }
  return parts.join(' · ');
}

/**
 * Supporting line for a search-result artist card.
 *
 * @param {{ disambiguation?: string, country?: string, type?: string }|null|undefined} artist
 * @param {boolean} isAdded - Whether the artist is already monitored.
 * @returns {string}
 */
export function buildSearchResultSupport(artist, isAdded) {
  if (isAdded) {
    return 'Already monitored. Open the artist to manage releases.';
  }
  if (artist?.disambiguation) {
    return artist.disambiguation;
  }
  if (artist?.country && artist?.type) {
    return 'Ready to add and track for future releases.';
  }
  return 'Add this artist to track future releases and unlock recommendations.';
}

// ── Artist avatar ────────────────────────────────────────────────────────────

/**
 * CSS style object for an artist avatar element.
 *
 * Delegates to the shared `buildAvatarStyle` helper in `artist-avatar.js`.
 *
 * @param {string|null} id   - MusicBrainz artist ID.
 * @param {string|null} name - Artist name.
 * @returns {{ background: string, color: string }}
 */
export function buildDiscoverAvatarStyle(id, name) {
  return buildAvatarStyle(id, name);
}

/**
 * Single uppercase initial character for an artist avatar.
 *
 * Delegates to the shared `buildAvatarInitial` helper in `artist-avatar.js`.
 *
 * @param {string|null} id   - MusicBrainz artist ID.
 * @param {string|null} name - Artist name.
 * @returns {string}
 */
export function buildDiscoverArtistInitial(id, name) {
  return buildAvatarInitial(id, name);
}
