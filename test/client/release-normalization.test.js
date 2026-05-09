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
  canRequestRelease,
  getReleaseArtistName,
  getReleaseRequestKey,
  getReleaseTitle,
  getReleaseYear,
  normalizeReleaseForRequest,
} from '../../src/client/lib/release-normalization.js';

// ---------------------------------------------------------------------------
// getReleaseArtistName
// ---------------------------------------------------------------------------

test('getReleaseArtistName returns artistCredit string when present', () => {
  const release = { artistCredit: 'Daft Punk', artist: { name: 'Other' } };
  assert.equal(getReleaseArtistName(release), 'Daft Punk');
});

test('getReleaseArtistName falls back to artist.name when artistCredit is absent', () => {
  const release = { artist: { name: 'Radiohead' } };
  assert.equal(getReleaseArtistName(release), 'Radiohead');
});

test('getReleaseArtistName falls back to artistName field', () => {
  const release = { artistName: 'Björk' };
  assert.equal(getReleaseArtistName(release), 'Björk');
});

test('getReleaseArtistName returns null when no artist info is available', () => {
  assert.equal(getReleaseArtistName({}), null);
  assert.equal(getReleaseArtistName(null), null);
});

test('getReleaseArtistName ignores blank artistCredit and falls through', () => {
  const release = { artistCredit: '   ', artist: { name: 'Portishead' } };
  assert.equal(getReleaseArtistName(release), 'Portishead');
});

// ---------------------------------------------------------------------------
// getReleaseTitle
// ---------------------------------------------------------------------------

test('getReleaseTitle returns title when present', () => {
  assert.equal(getReleaseTitle({ title: 'OK Computer' }), 'OK Computer');
});

test('getReleaseTitle falls back to releaseTitle field', () => {
  assert.equal(getReleaseTitle({ releaseTitle: 'Discovery' }), 'Discovery');
});

test('getReleaseTitle returns null when no title is available', () => {
  assert.equal(getReleaseTitle({}), null);
  assert.equal(getReleaseTitle(null), null);
});

// ---------------------------------------------------------------------------
// getReleaseYear
// ---------------------------------------------------------------------------

test('getReleaseYear extracts 4-digit year from a full date string', () => {
  assert.equal(getReleaseYear({ date: '1997-06-16' }), '1997');
});

test('getReleaseYear returns a bare 4-digit year unchanged', () => {
  assert.equal(getReleaseYear({ date: '2001' }), '2001');
});

test('getReleaseYear returns null when no date is available', () => {
  assert.equal(getReleaseYear({}), null);
  assert.equal(getReleaseYear(null), null);
});

// ---------------------------------------------------------------------------
// getReleaseRequestKey — MBID preference
// ---------------------------------------------------------------------------

test('getReleaseRequestKey prefers release MBID (id field)', () => {
  const release = {
    id: 'mbid-release-1',
    releaseGroup: { id: 'mbid-rg-1' },
    artistCredit: 'Artist',
    title: 'Title',
  };
  assert.equal(getReleaseRequestKey(release), 'release:mbid-release-1');
});

test('getReleaseRequestKey prefers musicbrainzReleaseId when id is absent', () => {
  const release = {
    musicbrainzReleaseId: 'mbid-release-2',
    releaseGroup: { id: 'mbid-rg-2' },
    artistCredit: 'Artist',
    title: 'Title',
  };
  assert.equal(getReleaseRequestKey(release), 'release:mbid-release-2');
});

test('getReleaseRequestKey falls back to release-group MBID when no release MBID', () => {
  const release = {
    releaseGroup: { id: 'mbid-rg-3' },
    artistCredit: 'Artist',
    title: 'Title',
  };
  assert.equal(getReleaseRequestKey(release), 'release-group:mbid-rg-3');
});

test('getReleaseRequestKey falls back to releaseGroupId when releaseGroup.id is absent', () => {
  const release = {
    releaseGroupId: 'mbid-rg-4',
    artistCredit: 'Artist',
    title: 'Title',
  };
  assert.equal(getReleaseRequestKey(release), 'release-group:mbid-rg-4');
});

test('getReleaseRequestKey produces normalized text key when no MBID available', () => {
  const release = {
    artistCredit: 'Portishead',
    title: 'Dummy',
    date: '1994-08-22',
  };
  const key = getReleaseRequestKey(release);
  assert.equal(key, 'text:portishead:dummy:1994');
});

test('getReleaseRequestKey text key normalizes whitespace and case', () => {
  const release = {
    artist: { name: '  Boards Of Canada  ' },
    title: '  Music Has The Right To Children  ',
    date: '1998',
  };
  const key = getReleaseRequestKey(release);
  assert.equal(key, 'text:boards of canada:music has the right to children:1998');
});

test('getReleaseRequestKey text key year is empty when no date', () => {
  const release = { artist: { name: 'Autechre' }, title: 'Tri Repetae' };
  const key = getReleaseRequestKey(release);
  assert.equal(key, 'text:autechre:tri repetae:');
});

test('getReleaseRequestKey returns null when no artist and no title and no MBID', () => {
  assert.equal(getReleaseRequestKey({}), null);
  assert.equal(getReleaseRequestKey(null), null);
});

// ---------------------------------------------------------------------------
// canRequestRelease
// ---------------------------------------------------------------------------

test('canRequestRelease returns true when both artist and title are present', () => {
  const release = { artistCredit: 'Massive Attack', title: 'Mezzanine' };
  assert.equal(canRequestRelease(release), true);
});

test('canRequestRelease returns false when artist is missing', () => {
  const release = { title: 'Unknown Artist Album' };
  assert.equal(canRequestRelease(release), false);
});

test('canRequestRelease returns false when title is missing', () => {
  const release = { artistCredit: 'Someone' };
  assert.equal(canRequestRelease(release), false);
});

test('canRequestRelease returns false for null/empty release', () => {
  assert.equal(canRequestRelease(null), false);
  assert.equal(canRequestRelease({}), false);
});

// ---------------------------------------------------------------------------
// normalizeReleaseForRequest
// ---------------------------------------------------------------------------

test('normalizeReleaseForRequest returns correct payload for a full release', () => {
  const release = {
    id: 'mbid-ram',
    artistCredit: 'Daft Punk',
    title: 'Random Access Memories',
    date: '2013-05-17',
  };
  const payload = normalizeReleaseForRequest(release);
  assert.deepEqual(payload, {
    artistName: 'Daft Punk',
    musicbrainzReleaseId: 'mbid-ram',
    releaseGroupId: null,
    releaseTitle: 'Random Access Memories',
    requestKind: 'release',
  });
});

test('normalizeReleaseForRequest includes releaseGroupId when available', () => {
  const release = {
    releaseGroupId: 'rg-123',
    artistCredit: 'Boards of Canada',
    title: 'Geogaddi',
  };
  const payload = normalizeReleaseForRequest(release);
  assert.equal(payload.releaseGroupId, 'rg-123');
  assert.equal(payload.musicbrainzReleaseId, null);
});

test('normalizeReleaseForRequest derives releaseGroupId from releaseGroup.id', () => {
  const release = {
    releaseGroup: { id: 'rg-from-nested' },
    artistCredit: 'Burial',
    title: 'Untrue',
  };
  const payload = normalizeReleaseForRequest(release);
  assert.equal(payload.releaseGroupId, 'rg-from-nested');
});

test('normalizeReleaseForRequest returns null when artist is missing', () => {
  const release = { title: 'Some Album' };
  assert.equal(normalizeReleaseForRequest(release), null);
});

test('normalizeReleaseForRequest returns null when title is missing', () => {
  const release = { artistCredit: 'Some Artist' };
  assert.equal(normalizeReleaseForRequest(release), null);
});

test('normalizeReleaseForRequest uses artist.name as fallback for artistName', () => {
  const release = {
    artist: { name: 'Floating Points' },
    title: 'Promises',
  };
  const payload = normalizeReleaseForRequest(release);
  assert.equal(payload?.artistName, 'Floating Points');
});
