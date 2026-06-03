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

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildDiscoverArtistInitial,
  buildDiscoverAvatarStyle,
  buildDiscoverMonitoredArtistNavAriaLabel,
  buildDiscoverMonitoredArtistsAriaLabel,
  buildDiscoverMonitoredBandCopy,
  buildDiscoverNoSimilarArtistsMessage,
  buildDiscoverPageSubtitle,
  buildDiscoverPreSearchBody,
  buildDiscoverRecommendationsSubtitle,
  buildDiscoverSearchErrorBody,
  buildDiscoverSuggestionsCopy,
  buildRecommendationMeta,
  buildRecommendationProvenance,
  buildRecommendationSupport,
  buildSearchResultBadgeLabel,
  buildSearchResultBadgeTone,
  buildSearchResultMeta,
  buildSearchResultSupport,
  formatDiscoverSearchError,
  resolveDiscoverSearchPanelMode,
} from '../../src/client/lib/discover-presentation.js';

// ── buildDiscoverPageSubtitle ─────────────────────────────────────────────────

test('buildDiscoverPageSubtitle returns a non-empty string', () => {
  const result = buildDiscoverPageSubtitle();
  assert.ok(typeof result === 'string' && result.length > 0);
});

test('buildDiscoverPageSubtitle uses add language', () => {
  assert.ok(buildDiscoverPageSubtitle().toLowerCase().includes('add'));
});

test('buildDiscoverPageSubtitle is stable across calls', () => {
  assert.equal(buildDiscoverPageSubtitle(), buildDiscoverPageSubtitle());
});

// ── buildDiscoverPreSearchBody ────────────────────────────────────────────────

test('buildDiscoverPreSearchBody returns a non-empty string', () => {
  const result = buildDiscoverPreSearchBody();
  assert.ok(typeof result === 'string' && result.length > 0);
});

test('buildDiscoverPreSearchBody uses add language', () => {
  assert.ok(buildDiscoverPreSearchBody().toLowerCase().includes('add'));
});

test('buildDiscoverPreSearchBody does not contain "surface"', () => {
  assert.ok(!buildDiscoverPreSearchBody().toLowerCase().includes('surface'));
});

test('buildDiscoverPreSearchBody does not describe UI mechanics', () => {
  // Should not tell users to click/press specific buttons
  assert.ok(!buildDiscoverPreSearchBody().toLowerCase().includes('press search'));
  assert.ok(!buildDiscoverPreSearchBody().toLowerCase().includes('type an artist'));
});

// ── formatDiscoverSearchError ─────────────────────────────────────────────────

test('formatDiscoverSearchError returns generic message for null', () => {
  assert.equal(formatDiscoverSearchError(null), 'Artist search failed. Try again.');
});

test('formatDiscoverSearchError returns generic message for undefined', () => {
  assert.equal(formatDiscoverSearchError(undefined), 'Artist search failed. Try again.');
});

test('formatDiscoverSearchError returns generic message for empty string', () => {
  assert.equal(formatDiscoverSearchError(''), 'Artist search failed. Try again.');
});

test('formatDiscoverSearchError normalizes MusicBrainz error (exact phrase)', () => {
  const result = formatDiscoverSearchError('MusicBrainz is temporarily unavailable');
  assert.equal(result, 'Artist search is temporarily unavailable. Try again in a moment.');
});

test('formatDiscoverSearchError normalizes MusicBrainz error (case insensitive)', () => {
  const result = formatDiscoverSearchError('musicbrainz service error');
  assert.equal(result, 'Artist search is temporarily unavailable. Try again in a moment.');
});

test('formatDiscoverSearchError normalizes MusicBrainz error in longer string', () => {
  const result = formatDiscoverSearchError('Request to MusicBrainz API timed out');
  assert.equal(result, 'Artist search is temporarily unavailable. Try again in a moment.');
});

test('formatDiscoverSearchError does not expose MusicBrainz name in output', () => {
  const result = formatDiscoverSearchError('MusicBrainz is down');
  assert.ok(!result.toLowerCase().includes('musicbrainz'));
});

test('formatDiscoverSearchError passes through unrecognised error messages', () => {
  const msg = 'Artist search failed. Please try again.';
  assert.equal(formatDiscoverSearchError(msg), msg);
});

test('formatDiscoverSearchError passes through network error messages', () => {
  const msg = 'Network request failed';
  assert.equal(formatDiscoverSearchError(msg), msg);
});

// ── buildDiscoverSearchErrorBody ──────────────────────────────────────────────

test('buildDiscoverSearchErrorBody returns a non-empty string', () => {
  const result = buildDiscoverSearchErrorBody();
  assert.ok(typeof result === 'string' && result.length > 0);
});

test('buildDiscoverSearchErrorBody does not mention MusicBrainz', () => {
  assert.ok(!buildDiscoverSearchErrorBody().toLowerCase().includes('musicbrainz'));
});

test('buildDiscoverSearchErrorBody is stable across calls', () => {
  assert.equal(buildDiscoverSearchErrorBody(), buildDiscoverSearchErrorBody());
});

// ── buildDiscoverRecommendationsSubtitle ──────────────────────────────────────

test('buildDiscoverRecommendationsSubtitle returns a non-empty string', () => {
  const result = buildDiscoverRecommendationsSubtitle();
  assert.ok(typeof result === 'string' && result.length > 0);
});

test('buildDiscoverRecommendationsSubtitle references monitored artists', () => {
  assert.ok(buildDiscoverRecommendationsSubtitle().toLowerCase().includes('monitored artists'));
});

test('buildDiscoverRecommendationsSubtitle does not use graph language', () => {
  assert.ok(!buildDiscoverRecommendationsSubtitle().toLowerCase().includes('graph'));
});

test('buildDiscoverRecommendationsSubtitle is stable across calls', () => {
  assert.equal(buildDiscoverRecommendationsSubtitle(), buildDiscoverRecommendationsSubtitle());
});

// ── buildDiscoverMonitoredArtistsAriaLabel ────────────────────────────────────

test('buildDiscoverMonitoredArtistsAriaLabel returns a non-empty string', () => {
  const result = buildDiscoverMonitoredArtistsAriaLabel();
  assert.ok(typeof result === 'string' && result.length > 0);
});

test('buildDiscoverMonitoredArtistsAriaLabel does not contain "seeds"', () => {
  assert.ok(!buildDiscoverMonitoredArtistsAriaLabel().toLowerCase().includes('seeds'));
});

test('buildDiscoverMonitoredArtistsAriaLabel references monitored artists', () => {
  assert.ok(buildDiscoverMonitoredArtistsAriaLabel().toLowerCase().includes('monitored artists'));
});

test('buildDiscoverMonitoredArtistsAriaLabel is stable across calls', () => {
  assert.equal(buildDiscoverMonitoredArtistsAriaLabel(), buildDiscoverMonitoredArtistsAriaLabel());
});

// ── buildDiscoverMonitoredArtistNavAriaLabel ──────────────────────────────────

test('buildDiscoverMonitoredArtistNavAriaLabel includes the artist name', () => {
  assert.ok(buildDiscoverMonitoredArtistNavAriaLabel('Radiohead').includes('Radiohead'));
});

test('buildDiscoverMonitoredArtistNavAriaLabel returns fallback for null name', () => {
  assert.equal(buildDiscoverMonitoredArtistNavAriaLabel(null), 'View this monitored artist');
});

test('buildDiscoverMonitoredArtistNavAriaLabel returns fallback for undefined name', () => {
  assert.equal(buildDiscoverMonitoredArtistNavAriaLabel(undefined), 'View this monitored artist');
});

test('buildDiscoverMonitoredArtistNavAriaLabel returns fallback for empty string', () => {
  assert.equal(buildDiscoverMonitoredArtistNavAriaLabel(''), 'View this monitored artist');
});

test('buildDiscoverMonitoredArtistNavAriaLabel uses navigation language, not destructive language', () => {
  const label = buildDiscoverMonitoredArtistNavAriaLabel('Björk');
  assert.ok(!label.toLowerCase().includes('remove'));
  assert.ok(!label.toLowerCase().includes('seed'));
  assert.ok(label.toLowerCase().includes('view'));
});

test('buildDiscoverMonitoredArtistNavAriaLabel produces correct label for known artist', () => {
  assert.equal(buildDiscoverMonitoredArtistNavAriaLabel('Björk'), 'View Björk');
});

// ── buildDiscoverMonitoredBandCopy ────────────────────────────────────────────

test('buildDiscoverMonitoredBandCopy returns a non-empty string', () => {
  const result = buildDiscoverMonitoredBandCopy();
  assert.ok(typeof result === 'string' && result.length > 0);
});

test('buildDiscoverMonitoredBandCopy does not use destructive language', () => {
  assert.ok(!buildDiscoverMonitoredBandCopy().toLowerCase().includes('remove'));
});

// ── buildDiscoverSuggestionsCopy ──────────────────────────────────────────────

test('buildDiscoverSuggestionsCopy returns a non-empty string', () => {
  const result = buildDiscoverSuggestionsCopy();
  assert.ok(typeof result === 'string' && result.length > 0);
});

test('buildDiscoverSuggestionsCopy references monitored artists', () => {
  assert.ok(buildDiscoverSuggestionsCopy().toLowerCase().includes('monitored artists'));
});

// ── buildDiscoverNoSimilarArtistsMessage ──────────────────────────────────────

test('buildDiscoverNoSimilarArtistsMessage returns a non-empty string', () => {
  const result = buildDiscoverNoSimilarArtistsMessage();
  assert.ok(typeof result === 'string' && result.length > 0);
});

test('buildDiscoverNoSimilarArtistsMessage does not use "picks"', () => {
  assert.ok(!buildDiscoverNoSimilarArtistsMessage().toLowerCase().includes('picks'));
});

test('buildDiscoverNoSimilarArtistsMessage is stable across calls', () => {
  assert.equal(buildDiscoverNoSimilarArtistsMessage(), buildDiscoverNoSimilarArtistsMessage());
});

// ── buildDiscoverAvatarStyle ──────────────────────────────────────────────────

test('buildDiscoverAvatarStyle returns an object with background and color', () => {
  const style = buildDiscoverAvatarStyle('a3cb23f0-dbf5-4b36-aa6d-98066b7a2c08', 'Radiohead');
  assert.ok(typeof style === 'object' && style !== null);
  assert.ok('background' in style, 'should have background key');
  assert.ok('color' in style, 'should have color key');
});

test('buildDiscoverAvatarStyle does not use bg or fg as keys', () => {
  const style = buildDiscoverAvatarStyle('a3cb23f0-dbf5-4b36-aa6d-98066b7a2c08', 'Radiohead');
  assert.ok(!('bg' in style), 'should not expose raw bg key');
  assert.ok(!('fg' in style), 'should not expose raw fg key');
});

test('buildDiscoverAvatarStyle background value is a non-empty string', () => {
  const style = buildDiscoverAvatarStyle('a3cb23f0-dbf5-4b36-aa6d-98066b7a2c08', 'Radiohead');
  assert.ok(typeof style.background === 'string' && style.background.length > 0);
});

test('buildDiscoverAvatarStyle color value is a non-empty string', () => {
  const style = buildDiscoverAvatarStyle('a3cb23f0-dbf5-4b36-aa6d-98066b7a2c08', 'Radiohead');
  assert.ok(typeof style.color === 'string' && style.color.length > 0);
});

test('buildDiscoverAvatarStyle is stable — same inputs produce same output', () => {
  const mbid = 'a3cb23f0-dbf5-4b36-aa6d-98066b7a2c08';
  const first = buildDiscoverAvatarStyle(mbid, 'Radiohead');
  const second = buildDiscoverAvatarStyle(mbid, 'Radiohead');
  assert.deepEqual(first, second);
});

test('buildDiscoverAvatarStyle handles null id without throwing', () => {
  assert.doesNotThrow(() => buildDiscoverAvatarStyle(null, 'Test Artist'));
});

// ── buildRecommendationProvenance ─────────────────────────────────────────────

test('buildRecommendationProvenance returns related badge for musicbrainz source', () => {
  const result = buildRecommendationProvenance({ sources: ['musicbrainz'] });
  assert.equal(result.label, 'Related artist');
  assert.equal(result.tone, 'info');
});

test('buildRecommendationProvenance returns listener badge for listenbrainz source', () => {
  const result = buildRecommendationProvenance({ sources: ['listenbrainz'] });
  assert.equal(result.label, 'Listener overlap');
  assert.equal(result.tone, 'info');
});

test('buildRecommendationProvenance treats lastfm as listener data', () => {
  assert.equal(buildRecommendationProvenance({ sources: ['lastfm'] }).label, 'Listener overlap');
});

test('buildRecommendationProvenance returns combined badge when both categories present', () => {
  const result = buildRecommendationProvenance({ sources: ['musicbrainz', 'listenbrainz'] });
  assert.equal(result.label, 'Related + listeners');
  assert.equal(result.tone, 'success');
});

test('buildRecommendationProvenance expands the "both" source into both categories', () => {
  const result = buildRecommendationProvenance({ sources: ['both'] });
  assert.equal(result.label, 'Related + listeners');
  assert.equal(result.tone, 'success');
});

test('buildRecommendationProvenance falls back to Recommended for unknown or empty sources', () => {
  assert.equal(buildRecommendationProvenance({ sources: [] }).label, 'Recommended');
  assert.equal(buildRecommendationProvenance({ sources: ['mystery'] }).label, 'Recommended');
  assert.equal(buildRecommendationProvenance(null).label, 'Recommended');
});

test('buildRecommendationProvenance label is always from the fixed enumeration (injection-safe)', () => {
  const allowed = new Set(['Related + listeners', 'Related artist', 'Listener overlap', 'Recommended']);
  const evil = buildRecommendationProvenance({ sources: ['<img src=x onerror=alert(1)>'] });
  assert.ok(allowed.has(evil.label));
});

// ── buildRecommendationMeta ───────────────────────────────────────────────────

test('buildRecommendationMeta references monitored artists for multiple matches', () => {
  const meta = buildRecommendationMeta({ seedCount: 4 });
  assert.ok(meta.includes('4'));
  assert.ok(meta.toLowerCase().includes('monitored artists'));
});

test('buildRecommendationMeta returns single-source copy for one match', () => {
  assert.equal(buildRecommendationMeta({ seedCount: 1 }), 'From your monitored artists');
});

test('buildRecommendationMeta returns empty string for null', () => {
  assert.equal(buildRecommendationMeta(null), '');
});

// ── buildRecommendationSupport ────────────────────────────────────────────────

test('buildRecommendationSupport returns strong-overlap copy for high score', () => {
  assert.ok(buildRecommendationSupport({ score: 2 }).toLowerCase().includes('overlap'));
});

test('buildRecommendationSupport returns add-prompt copy for low score', () => {
  assert.ok(buildRecommendationSupport({ score: 0.5 }).toLowerCase().includes('add'));
});

test('buildRecommendationSupport does not use graph or taste-profile jargon', () => {
  const high = buildRecommendationSupport({ score: 2 }).toLowerCase();
  const low = buildRecommendationSupport({ score: 0.5 }).toLowerCase();
  assert.ok(!high.includes('graph') && !high.includes('taste profile'));
  assert.ok(!low.includes('graph') && !low.includes('taste profile'));
});

test('buildRecommendationSupport returns empty string for null', () => {
  assert.equal(buildRecommendationSupport(null), '');
});

// ── buildSearchResultBadgeLabel / Tone ────────────────────────────────────────

test('buildSearchResultBadgeLabel returns "Monitored" when added', () => {
  assert.equal(buildSearchResultBadgeLabel(true), 'Monitored');
});

test('buildSearchResultBadgeLabel returns "Search match" when not added', () => {
  assert.equal(buildSearchResultBadgeLabel(false), 'Search match');
});

test('buildSearchResultBadgeTone returns success when added', () => {
  assert.equal(buildSearchResultBadgeTone(true), 'success');
});

test('buildSearchResultBadgeTone returns info when not added', () => {
  assert.equal(buildSearchResultBadgeTone(false), 'info');
});

// ── buildSearchResultMeta ─────────────────────────────────────────────────────

test('buildSearchResultMeta joins type and country', () => {
  assert.equal(buildSearchResultMeta({ type: 'Group', country: 'GB' }), 'Group · GB');
});

test('buildSearchResultMeta returns only available parts', () => {
  assert.equal(buildSearchResultMeta({ type: 'Person' }), 'Person');
});

test('buildSearchResultMeta returns empty string for null', () => {
  assert.equal(buildSearchResultMeta(null), '');
});

// ── buildSearchResultSupport ──────────────────────────────────────────────────

test('buildSearchResultSupport references monitoring when already added', () => {
  assert.ok(buildSearchResultSupport({}, true).toLowerCase().includes('monitored'));
});

test('buildSearchResultSupport prefers disambiguation when present', () => {
  assert.equal(
    buildSearchResultSupport({ disambiguation: 'British band' }, false),
    'British band',
  );
});

test('buildSearchResultSupport returns add-prompt copy as a fallback', () => {
  assert.ok(buildSearchResultSupport({}, false).toLowerCase().includes('add'));
});

// ── resolveDiscoverSearchPanelMode ────────────────────────────────────────────

const baseModeFlags = {
  searchError: null,
  hasSearched: false,
  isSearching: false,
  resultCount: 0,
  hasSeeds: false,
};

test('resolveDiscoverSearchPanelMode returns "error" when a search error is present', () => {
  const mode = resolveDiscoverSearchPanelMode({ ...baseModeFlags, searchError: 'boom', hasSeeds: true });
  assert.equal(mode, 'error');
});

test('resolveDiscoverSearchPanelMode error takes precedence over every other flag', () => {
  const mode = resolveDiscoverSearchPanelMode({
    searchError: 'boom',
    hasSearched: true,
    isSearching: true,
    resultCount: 5,
    hasSeeds: true,
  });
  assert.equal(mode, 'error');
});

test('resolveDiscoverSearchPanelMode returns "pre-search" before any search with no seeds', () => {
  assert.equal(resolveDiscoverSearchPanelMode(baseModeFlags), 'pre-search');
});

test('resolveDiscoverSearchPanelMode returns "searching" when a request is in flight', () => {
  const mode = resolveDiscoverSearchPanelMode({ ...baseModeFlags, hasSearched: true, isSearching: true });
  assert.equal(mode, 'searching');
});

test('resolveDiscoverSearchPanelMode returns "empty" when a completed search has no results', () => {
  const mode = resolveDiscoverSearchPanelMode({ ...baseModeFlags, hasSearched: true, resultCount: 0 });
  assert.equal(mode, 'empty');
});

test('resolveDiscoverSearchPanelMode returns "results" when a completed search has results', () => {
  const mode = resolveDiscoverSearchPanelMode({ ...baseModeFlags, hasSearched: true, resultCount: 3 });
  assert.equal(mode, 'results');
});

test('resolveDiscoverSearchPanelMode returns "idle" with seeds present but no search run', () => {
  const mode = resolveDiscoverSearchPanelMode({ ...baseModeFlags, hasSeeds: true });
  assert.equal(mode, 'idle');
});

test('resolveDiscoverSearchPanelMode does not show pre-search once seeds exist', () => {
  const mode = resolveDiscoverSearchPanelMode({ ...baseModeFlags, hasSeeds: true });
  assert.notEqual(mode, 'pre-search');
});

test('buildDiscoverAvatarStyle handles null name without throwing', () => {
  assert.doesNotThrow(() => buildDiscoverAvatarStyle('some-mbid', null));
});

// ── buildDiscoverArtistInitial ────────────────────────────────────────────────

test('buildDiscoverArtistInitial returns uppercase first letter of name', () => {
  assert.equal(buildDiscoverArtistInitial('some-mbid', 'radiohead'), 'R');
});

test('buildDiscoverArtistInitial handles non-ASCII names', () => {
  const initial = buildDiscoverArtistInitial('some-mbid', 'björk');
  assert.equal(initial, 'B');
});

test('buildDiscoverArtistInitial returns ? for empty name', () => {
  assert.equal(buildDiscoverArtistInitial('some-mbid', ''), '?');
});

test('buildDiscoverArtistInitial returns ? for null name', () => {
  assert.equal(buildDiscoverArtistInitial('some-mbid', null), '?');
});

test('buildDiscoverArtistInitial returns a single character', () => {
  const initial = buildDiscoverArtistInitial('some-mbid', 'Massive Attack');
  assert.equal(initial.length, 1);
});

test('buildDiscoverArtistInitial is stable — same inputs produce same output', () => {
  const mbid = 'a3cb23f0-dbf5-4b36-aa6d-98066b7a2c08';
  assert.equal(
    buildDiscoverArtistInitial(mbid, 'Radiohead'),
    buildDiscoverArtistInitial(mbid, 'Radiohead'),
  );
});

test('buildDiscoverArtistInitial handles null id without throwing', () => {
  assert.doesNotThrow(() => buildDiscoverArtistInitial(null, 'Test Artist'));
});
