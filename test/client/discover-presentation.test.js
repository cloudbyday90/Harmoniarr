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
  buildDiscoverGraphSubtitle,
  buildDiscoverNoSimilarArtistsMessage,
  buildDiscoverPageSubtitle,
  buildDiscoverPreSearchBody,
  buildDiscoverSearchErrorBody,
  buildDiscoverSeedRemoveAriaLabel,
  buildDiscoverSeedsAriaLabel,
  formatDiscoverSearchError,
} from '../../src/client/lib/discover-presentation.js';

// ── buildDiscoverPageSubtitle ─────────────────────────────────────────────────

test('buildDiscoverPageSubtitle returns a non-empty string', () => {
  const result = buildDiscoverPageSubtitle();
  assert.ok(typeof result === 'string' && result.length > 0);
});

test('buildDiscoverPageSubtitle does not contain "monitor"', () => {
  assert.ok(!buildDiscoverPageSubtitle().toLowerCase().includes('monitor'));
});

test('buildDiscoverPageSubtitle is stable across calls', () => {
  assert.equal(buildDiscoverPageSubtitle(), buildDiscoverPageSubtitle());
});

// ── buildDiscoverPreSearchBody ────────────────────────────────────────────────

test('buildDiscoverPreSearchBody returns a non-empty string', () => {
  const result = buildDiscoverPreSearchBody();
  assert.ok(typeof result === 'string' && result.length > 0);
});

test('buildDiscoverPreSearchBody does not contain "monitor"', () => {
  assert.ok(!buildDiscoverPreSearchBody().toLowerCase().includes('monitor'));
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

// ── buildDiscoverGraphSubtitle ────────────────────────────────────────────────

test('buildDiscoverGraphSubtitle returns a non-empty string', () => {
  const result = buildDiscoverGraphSubtitle();
  assert.ok(typeof result === 'string' && result.length > 0);
});

test('buildDiscoverGraphSubtitle does not contain "monitored"', () => {
  assert.ok(!buildDiscoverGraphSubtitle().toLowerCase().includes('monitored'));
});

test('buildDiscoverGraphSubtitle is stable across calls', () => {
  assert.equal(buildDiscoverGraphSubtitle(), buildDiscoverGraphSubtitle());
});

// ── buildDiscoverSeedsAriaLabel ───────────────────────────────────────────────

test('buildDiscoverSeedsAriaLabel returns a non-empty string', () => {
  const result = buildDiscoverSeedsAriaLabel();
  assert.ok(typeof result === 'string' && result.length > 0);
});

test('buildDiscoverSeedsAriaLabel does not contain "seeds"', () => {
  assert.ok(!buildDiscoverSeedsAriaLabel().toLowerCase().includes('seeds'));
});

test('buildDiscoverSeedsAriaLabel is stable across calls', () => {
  assert.equal(buildDiscoverSeedsAriaLabel(), buildDiscoverSeedsAriaLabel());
});

// ── buildDiscoverSeedRemoveAriaLabel ──────────────────────────────────────────

test('buildDiscoverSeedRemoveAriaLabel includes the artist name', () => {
  assert.ok(buildDiscoverSeedRemoveAriaLabel('Radiohead').includes('Radiohead'));
});

test('buildDiscoverSeedRemoveAriaLabel returns fallback for null name', () => {
  assert.equal(buildDiscoverSeedRemoveAriaLabel(null), 'Stop following this artist');
});

test('buildDiscoverSeedRemoveAriaLabel returns fallback for undefined name', () => {
  assert.equal(buildDiscoverSeedRemoveAriaLabel(undefined), 'Stop following this artist');
});

test('buildDiscoverSeedRemoveAriaLabel returns fallback for empty string', () => {
  assert.equal(buildDiscoverSeedRemoveAriaLabel(''), 'Stop following this artist');
});

test('buildDiscoverSeedRemoveAriaLabel uses follow-language, not monitor-language', () => {
  const label = buildDiscoverSeedRemoveAriaLabel('Björk');
  assert.ok(!label.toLowerCase().includes('monitor'));
  assert.ok(!label.toLowerCase().includes('seed'));
});

test('buildDiscoverSeedRemoveAriaLabel produces correct label for known artist', () => {
  assert.equal(buildDiscoverSeedRemoveAriaLabel('Björk'), 'Stop following Björk');
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
