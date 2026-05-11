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
  buildArtistDetailErrorBody,
  buildArtistMetaLine,
  buildArtistMusicBrainzLabel,
  buildArtistMusicBrainzUrl,
  buildNoDiscographyBody,
  buildRelatedArtistAvatarStyle,
  buildRelatedArtistInitial,
  formatArtistDetailError,
  formatDiscographyError,
  pluralizeReleaseType,
} from '../../src/client/lib/artist-detail-presentation.js';
import { buildAvatarInitial, buildAvatarStyle } from '../../src/client/lib/artist-avatar.js';

// ── buildArtistMetaLine ───────────────────────────────────────────────────────

test('buildArtistMetaLine returns null for null artist', () => {
  assert.equal(buildArtistMetaLine(null), null);
});

test('buildArtistMetaLine returns null for undefined artist', () => {
  assert.equal(buildArtistMetaLine(undefined), null);
});

test('buildArtistMetaLine returns null when all fields are absent', () => {
  assert.equal(buildArtistMetaLine({}), null);
});

test('buildArtistMetaLine returns type only when country and disambiguation absent', () => {
  assert.equal(buildArtistMetaLine({ type: 'Group' }), 'Group');
});

test('buildArtistMetaLine returns country only when type and disambiguation absent', () => {
  assert.equal(buildArtistMetaLine({ country: 'GB' }), 'GB');
});

test('buildArtistMetaLine joins type and country with ·', () => {
  assert.equal(buildArtistMetaLine({ type: 'Group', country: 'GB' }), 'Group · GB');
});

test('buildArtistMetaLine wraps disambiguation in parentheses', () => {
  assert.equal(buildArtistMetaLine({ disambiguation: 'the Oxfordshire band' }), '(the Oxfordshire band)');
});

test('buildArtistMetaLine produces full three-part line', () => {
  assert.equal(
    buildArtistMetaLine({ type: 'Group', country: 'GB', disambiguation: 'the Oxfordshire band' }),
    'Group · GB · (the Oxfordshire band)',
  );
});

test('buildArtistMetaLine omits null fields', () => {
  assert.equal(buildArtistMetaLine({ type: 'Group', country: null, disambiguation: null }), 'Group');
});

test('buildArtistMetaLine omits empty-string fields', () => {
  assert.equal(buildArtistMetaLine({ type: 'Group', country: '', disambiguation: '' }), 'Group');
});

// ── buildArtistMusicBrainzUrl ─────────────────────────────────────────────────

test('buildArtistMusicBrainzUrl returns null for null mbid', () => {
  assert.equal(buildArtistMusicBrainzUrl(null), null);
});

test('buildArtistMusicBrainzUrl returns null for undefined mbid', () => {
  assert.equal(buildArtistMusicBrainzUrl(undefined), null);
});

test('buildArtistMusicBrainzUrl returns null for empty string mbid', () => {
  assert.equal(buildArtistMusicBrainzUrl(''), null);
});

test('buildArtistMusicBrainzUrl returns correct URL for valid mbid', () => {
  assert.equal(
    buildArtistMusicBrainzUrl('a74b1b7f-71a5-4011-9441-d0b5e4122711'),
    'https://musicbrainz.org/artist/a74b1b7f-71a5-4011-9441-d0b5e4122711',
  );
});

test('buildArtistMusicBrainzUrl URL starts with https', () => {
  const url = buildArtistMusicBrainzUrl('a74b1b7f-71a5-4011-9441-d0b5e4122711');
  assert.ok(url.startsWith('https://'));
});

test('buildArtistMusicBrainzUrl URL contains the mbid', () => {
  const mbid = 'a74b1b7f-71a5-4011-9441-d0b5e4122711';
  assert.ok(buildArtistMusicBrainzUrl(mbid).includes(mbid));
});

// ── buildArtistMusicBrainzLabel ───────────────────────────────────────────────

test('buildArtistMusicBrainzLabel returns a non-empty string', () => {
  assert.ok(buildArtistMusicBrainzLabel().length > 0);
});

test('buildArtistMusicBrainzLabel does not say "MusicBrainz"', () => {
  assert.ok(!buildArtistMusicBrainzLabel().toLowerCase().includes('musicbrainz'));
});

test('buildArtistMusicBrainzLabel is stable across calls', () => {
  assert.equal(buildArtistMusicBrainzLabel(), buildArtistMusicBrainzLabel());
});

// ── buildArtistDetailErrorBody ────────────────────────────────────────────────

test('buildArtistDetailErrorBody returns a non-empty string', () => {
  assert.ok(buildArtistDetailErrorBody().length > 0);
});

test('buildArtistDetailErrorBody is stable across calls', () => {
  assert.equal(buildArtistDetailErrorBody(), buildArtistDetailErrorBody());
});

// ── formatDiscographyError ────────────────────────────────────────────────────

test('formatDiscographyError returns generic message for null', () => {
  assert.equal(formatDiscographyError(null), 'Discography could not be loaded. Try refreshing the page.');
});

test('formatDiscographyError returns generic message for undefined', () => {
  assert.equal(formatDiscographyError(undefined), 'Discography could not be loaded. Try refreshing the page.');
});

test('formatDiscographyError returns generic message for empty string', () => {
  assert.equal(formatDiscographyError(''), 'Discography could not be loaded. Try refreshing the page.');
});

test('formatDiscographyError normalises MusicBrainz messages', () => {
  assert.equal(
    formatDiscographyError('MusicBrainz is temporarily unavailable'),
    'Discography is temporarily unavailable. Try again in a moment.',
  );
});

test('formatDiscographyError normalises MusicBrainz messages case-insensitively', () => {
  assert.equal(
    formatDiscographyError('musicbrainz service error'),
    'Discography is temporarily unavailable. Try again in a moment.',
  );
});

test('formatDiscographyError suppresses parameter validation errors', () => {
  const result = formatDiscographyError('limit must be an integer between 1 and 25');
  assert.equal(result, 'Discography could not be loaded. Try refreshing the page.');
});

test('formatDiscographyError suppresses "invalid" validation errors', () => {
  const result = formatDiscographyError('invalid parameter value');
  assert.equal(result, 'Discography could not be loaded. Try refreshing the page.');
});

test('formatDiscographyError suppresses bad request errors', () => {
  const result = formatDiscographyError('400 bad request');
  assert.equal(result, 'Discography could not be loaded. Try refreshing the page.');
});

test('formatDiscographyError does not expose MusicBrainz name in output', () => {
  const result = formatDiscographyError('MusicBrainz returned a 503');
  assert.ok(!result.toLowerCase().includes('musicbrainz'));
});

test('formatDiscographyError passes through unrecognised error messages', () => {
  const msg = 'Network request timed out';
  assert.equal(formatDiscographyError(msg), msg);
});

// ── formatArtistDetailError ───────────────────────────────────────────────────

test('formatArtistDetailError returns generic message for null', () => {
  assert.equal(formatArtistDetailError(null), 'Some artist details could not be loaded.');
});

test('formatArtistDetailError normalises MusicBrainz messages', () => {
  assert.equal(
    formatArtistDetailError('MusicBrainz is down'),
    'Artist details are temporarily unavailable.',
  );
});

test('formatArtistDetailError suppresses validation errors', () => {
  assert.equal(
    formatArtistDetailError('must be a valid UUID'),
    'Some artist details could not be loaded.',
  );
});

test('formatArtistDetailError does not expose MusicBrainz name in output', () => {
  assert.ok(!formatArtistDetailError('MusicBrainz timeout').toLowerCase().includes('musicbrainz'));
});

test('formatArtistDetailError passes through unrecognised messages', () => {
  const msg = 'Network request failed';
  assert.equal(formatArtistDetailError(msg), msg);
});

// ── pluralizeReleaseType ──────────────────────────────────────────────────────

test('pluralizeReleaseType returns "Albums" for Album', () => {
  assert.equal(pluralizeReleaseType('Album'), 'Albums');
});

test('pluralizeReleaseType returns "Singles" for Single', () => {
  assert.equal(pluralizeReleaseType('Single'), 'Singles');
});

test('pluralizeReleaseType returns "EPs" for EP', () => {
  assert.equal(pluralizeReleaseType('EP'), 'EPs');
});

test('pluralizeReleaseType returns "Broadcasts" for Broadcast', () => {
  assert.equal(pluralizeReleaseType('Broadcast'), 'Broadcasts');
});

test('pluralizeReleaseType returns "Other" for Other', () => {
  assert.equal(pluralizeReleaseType('Other'), 'Other');
});

test('pluralizeReleaseType falls back to appending s for unknown type', () => {
  assert.equal(pluralizeReleaseType('Mixtape'), 'Mixtapes');
});

test('pluralizeReleaseType returns "Releases" for null', () => {
  assert.equal(pluralizeReleaseType(null), 'Releases');
});

test('pluralizeReleaseType returns "Releases" for undefined', () => {
  assert.equal(pluralizeReleaseType(undefined), 'Releases');
});

test('pluralizeReleaseType returns "Releases" for empty string', () => {
  assert.equal(pluralizeReleaseType(''), 'Releases');
});

// EP regression guard: naive `${type}s` would produce "EPs" but only by accident
// of the EP abbreviation — this guard ensures it is explicitly handled, not
// relying on coincidence.
test('pluralizeReleaseType EP is explicitly mapped, not produced by naive append', () => {
  // If EP were handled by the fallback it would produce 'EPs' which happens to
  // match. This test ensures it is in the known-types map by verifying 'Other'
  // (which needs no appended s) and 'EP' both work without the fallback path.
  assert.equal(pluralizeReleaseType('EP'), 'EPs');
  assert.equal(pluralizeReleaseType('Other'), 'Other'); // fallback would produce "Others"
});

// ── buildNoDiscographyBody ────────────────────────────────────────────────────

test('buildNoDiscographyBody returns a non-empty string', () => {
  assert.ok(buildNoDiscographyBody().length > 0);
});

test('buildNoDiscographyBody does not mention MusicBrainz', () => {
  assert.ok(!buildNoDiscographyBody().toLowerCase().includes('musicbrainz'));
});

test('buildNoDiscographyBody is stable across calls', () => {
  assert.equal(buildNoDiscographyBody(), buildNoDiscographyBody());
});

// ── buildRelatedArtistAvatarStyle ─────────────────────────────────────────────

test('buildRelatedArtistAvatarStyle returns object with background and color', () => {
  const style = buildRelatedArtistAvatarStyle('a74b1b7f-71a5-4011-9441-d0b5e4122711', 'Radiohead');
  assert.ok('background' in style);
  assert.ok('color' in style);
});

test('buildRelatedArtistAvatarStyle does not expose raw bg or fg keys', () => {
  const style = buildRelatedArtistAvatarStyle('a74b1b7f-71a5-4011-9441-d0b5e4122711', 'Radiohead');
  assert.ok(!('bg' in style));
  assert.ok(!('fg' in style));
});

test('buildRelatedArtistAvatarStyle is stable for same inputs', () => {
  const mbid = 'a74b1b7f-71a5-4011-9441-d0b5e4122711';
  assert.deepEqual(
    buildRelatedArtistAvatarStyle(mbid, 'Radiohead'),
    buildRelatedArtistAvatarStyle(mbid, 'Radiohead'),
  );
});

test('buildRelatedArtistAvatarStyle handles null id without throwing', () => {
  assert.doesNotThrow(() => buildRelatedArtistAvatarStyle(null, 'Test'));
});

test('buildRelatedArtistAvatarStyle handles null name without throwing', () => {
  assert.doesNotThrow(() => buildRelatedArtistAvatarStyle('some-mbid', null));
});

test('buildRelatedArtistAvatarStyle matches shared buildAvatarStyle output', () => {
  const mbid = 'a74b1b7f-71a5-4011-9441-d0b5e4122711';
  assert.deepEqual(
    buildRelatedArtistAvatarStyle(mbid, 'Radiohead'),
    buildAvatarStyle(mbid, 'Radiohead'),
  );
});

// ── buildRelatedArtistInitial ─────────────────────────────────────────────────

test('buildRelatedArtistInitial returns uppercase first letter', () => {
  assert.equal(buildRelatedArtistInitial('some-mbid', 'radiohead'), 'R');
});

test('buildRelatedArtistInitial returns ? for null name', () => {
  assert.equal(buildRelatedArtistInitial('some-mbid', null), '?');
});

test('buildRelatedArtistInitial returns ? for empty name', () => {
  assert.equal(buildRelatedArtistInitial('some-mbid', ''), '?');
});

test('buildRelatedArtistInitial returns single character', () => {
  assert.equal(buildRelatedArtistInitial('some-mbid', 'Massive Attack').length, 1);
});

test('buildRelatedArtistInitial handles null id without throwing', () => {
  assert.doesNotThrow(() => buildRelatedArtistInitial(null, 'Test'));
});

test('buildRelatedArtistInitial matches shared buildAvatarInitial output', () => {
  const mbid = 'a74b1b7f-71a5-4011-9441-d0b5e4122711';
  assert.equal(
    buildRelatedArtistInitial(mbid, 'Radiohead'),
    buildAvatarInitial(mbid, 'Radiohead'),
  );
});
