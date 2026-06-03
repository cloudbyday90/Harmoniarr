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
  buildReleaseTracklistExpectations,
  matchExpectedTracklist,
  normalizeMatchText,
  scoreTracklistMatch,
  sequenceMatchRatio,
} from '../../src/server/library/candidate-track-matcher.js';

// --- sequenceMatchRatio: parity with Python difflib.SequenceMatcher.ratio() ---

test('sequenceMatchRatio matches difflib for "abcd"/"bcde" (0.75)', () => {
  assert.equal(sequenceMatchRatio('abcd', 'bcde'), 0.75);
});

test('sequenceMatchRatio matches difflib for "abxcd"/"abcd" (8/9)', () => {
  assert.equal(sequenceMatchRatio('abxcd', 'abcd'), 8 / 9);
});

test('sequenceMatchRatio is 1 for identical strings', () => {
  assert.equal(sequenceMatchRatio('hello world', 'hello world'), 1);
});

test('sequenceMatchRatio is 1 for two empty strings', () => {
  assert.equal(sequenceMatchRatio('', ''), 1);
});

test('sequenceMatchRatio is 0 when one string is empty', () => {
  assert.equal(sequenceMatchRatio('', 'abc'), 0);
  assert.equal(sequenceMatchRatio('abc', ''), 0);
});

test('sequenceMatchRatio is 0 for non-string input', () => {
  assert.equal(sequenceMatchRatio(null, 'abc'), 0);
  assert.equal(sequenceMatchRatio('abc', 42), 0);
});

test('sequenceMatchRatio is symmetric for these inputs', () => {
  assert.equal(sequenceMatchRatio('private thread', 'private volatile thread'), sequenceMatchRatio('private volatile thread', 'private thread'));
});

test('sequenceMatchRatio bounds extremely long inputs without throwing', () => {
  const long = 'a'.repeat(5000);
  const ratio = sequenceMatchRatio(long, long);
  assert.equal(ratio, 1);
});

// --- normalizeMatchText ---

test('normalizeMatchText lowercases, strips punctuation and collapses spaces', () => {
  assert.equal(normalizeMatchText('  The/Track - Name!! '), 'the track name');
});

test('normalizeMatchText strips diacritics', () => {
  assert.equal(normalizeMatchText('Café Déjà Vu'), 'cafe deja vu');
});

test('normalizeMatchText returns empty string for non-text', () => {
  assert.equal(normalizeMatchText(null), '');
  assert.equal(normalizeMatchText({}), '');
});

// --- matchExpectedTracklist ---

test('matchExpectedTracklist returns null when there are no expected titles', () => {
  assert.equal(matchExpectedTracklist({ expectedTrackTitles: [], candidateFilenames: ['a.flac'] }), null);
  assert.equal(matchExpectedTracklist({ expectedTrackTitles: null, candidateFilenames: ['a.flac'] }), null);
});

test('matchExpectedTracklist matches a clean folder with leading track numbers', () => {
  const summary = matchExpectedTracklist({
    expectedTrackTitles: ['Come Together', 'Something', 'Maxwells Silver Hammer'],
    candidateFilenames: [
      'Beatles\\Abbey Road\\01 - Come Together.flac',
      'Beatles\\Abbey Road\\02 - Something.flac',
      'Beatles\\Abbey Road\\03 - Maxwells Silver Hammer.flac',
    ],
  });

  assert.equal(summary.expectedTrackCount, 3);
  assert.equal(summary.matchedTrackCount, 3);
  assert.equal(summary.coverageRatio, 1);
  assert.equal(summary.unmatchedTrackTitles.length, 0);
  assert.ok(summary.averageMatchRatio >= 0.9);
});

test('matchExpectedTracklist ignores non-audio files in the folder', () => {
  const summary = matchExpectedTracklist({
    expectedTrackTitles: ['Come Together'],
    candidateFilenames: [
      'folder\\01 - Come Together.flac',
      'folder\\cover.jpg',
      'folder\\playlist.m3u',
      'folder\\notes.txt',
    ],
  });

  assert.equal(summary.audioFileCount, 1);
  assert.equal(summary.matchedTrackCount, 1);
  assert.equal(summary.extraFileCount, 0);
});

test('matchExpectedTracklist reports a partial album as partial coverage', () => {
  const summary = matchExpectedTracklist({
    expectedTrackTitles: ['Track One', 'Track Two', 'Track Three', 'Track Four'],
    candidateFilenames: [
      '01 - Track One.mp3',
      '02 - Track Two.mp3',
    ],
  });

  assert.equal(summary.matchedTrackCount, 2);
  assert.equal(summary.coverageRatio, 0.5);
  assert.deepEqual(summary.unmatchedTrackTitles, ['Track Three', 'Track Four']);
});

test('matchExpectedTracklist assigns each candidate file to at most one track', () => {
  const summary = matchExpectedTracklist({
    expectedTrackTitles: ['Intro', 'Intro'],
    candidateFilenames: ['01 - Intro.flac'],
  });

  // Only one file exists, so only one of the two identical tracks can be matched.
  assert.equal(summary.matchedTrackCount, 1);
});

test('matchExpectedTracklist matches a title that legitimately starts with a number', () => {
  const summary = matchExpectedTracklist({
    expectedTrackTitles: ['100 Years'],
    candidateFilenames: ['07 100 Years.flac'],
  });

  assert.equal(summary.matchedTrackCount, 1);
});

test('matchExpectedTracklist uses album-prepended filenames as a strategy', () => {
  const summary = matchExpectedTracklist({
    expectedTrackTitles: ['Yesterday'],
    albumTitle: 'Help',
    candidateFilenames: ['Help - Yesterday.mp3'],
  });

  assert.equal(summary.matchedTrackCount, 1);
});

test('matchExpectedTracklist does not match unrelated filenames', () => {
  const summary = matchExpectedTracklist({
    expectedTrackTitles: ['Bohemian Rhapsody'],
    candidateFilenames: ['random_noise_file_xyz.mp3'],
  });

  assert.equal(summary.matchedTrackCount, 0);
  assert.equal(summary.coverageRatio, 0);
});

test('matchExpectedTracklist honors a custom minimum ratio', () => {
  const strict = matchExpectedTracklist({
    expectedTrackTitles: ['Some Track Title'],
    candidateFilenames: ['Some Track Titl.mp3'],
    minimumRatio: 0.99,
  });
  assert.equal(strict.matchedTrackCount, 0);

  const lenient = matchExpectedTracklist({
    expectedTrackTitles: ['Some Track Title'],
    candidateFilenames: ['Some Track Titl.mp3'],
    minimumRatio: 0.5,
  });
  assert.equal(lenient.matchedTrackCount, 1);
});

test('matchExpectedTracklist tolerates hostile filenames without throwing', () => {
  const summary = matchExpectedTracklist({
    expectedTrackTitles: ['Song'],
    candidateFilenames: ['song"; rm -rf /; echo ".flac', '../../etc/passwd.mp3'],
  });

  assert.ok(summary);
  assert.equal(typeof summary.matchedTrackCount, 'number');
});

test('matchExpectedTracklist per-track evidence includes matched filename and ratio', () => {
  const summary = matchExpectedTracklist({
    expectedTrackTitles: ['Come Together'],
    candidateFilenames: ['01 - Come Together.flac'],
  });

  const [track] = summary.perTrack;
  assert.equal(track.trackTitle, 'Come Together');
  assert.equal(track.matched, true);
  assert.equal(track.matchedFilename, '01 - Come Together.flac');
  assert.ok(track.ratio > 0.9);
});

// --- scoreTracklistMatch ---

test('scoreTracklistMatch returns neutral 50 for a null summary', () => {
  assert.equal(scoreTracklistMatch(null), 50);
});

test('scoreTracklistMatch returns 0 when no tracks matched', () => {
  assert.equal(scoreTracklistMatch({ expectedTrackCount: 5, matchedTrackCount: 0, coverageRatio: 0, averageMatchRatio: 0 }), 0);
});

test('scoreTracklistMatch returns 100 for a complete, high-quality match', () => {
  assert.equal(scoreTracklistMatch({ expectedTrackCount: 10, matchedTrackCount: 10, coverageRatio: 1, averageMatchRatio: 1 }), 100);
});

test('scoreTracklistMatch discounts a complete-but-weak match below a clean one', () => {
  const weak = scoreTracklistMatch({ expectedTrackCount: 10, matchedTrackCount: 10, coverageRatio: 1, averageMatchRatio: 0.55 });
  const clean = scoreTracklistMatch({ expectedTrackCount: 10, matchedTrackCount: 10, coverageRatio: 1, averageMatchRatio: 1 });
  assert.ok(weak < clean);
  assert.ok(weak >= 80);
});

test('scoreTracklistMatch scales with coverage', () => {
  const half = scoreTracklistMatch({ expectedTrackCount: 10, matchedTrackCount: 5, coverageRatio: 0.5, averageMatchRatio: 1 });
  const full = scoreTracklistMatch({ expectedTrackCount: 10, matchedTrackCount: 10, coverageRatio: 1, averageMatchRatio: 1 });
  assert.ok(half < full);
});

// --- buildReleaseTracklistExpectations ---

test('buildReleaseTracklistExpectations extracts titles, count and duration', () => {
  const result = buildReleaseTracklistExpectations([
    { title: 'One', length_ms: 180000 },
    { title: 'Two', recording_length_ms: 210000 },
    { title: '  ', length_ms: 0 },
  ]);

  assert.deepEqual(result.expectedTrackTitles, ['One', 'Two']);
  assert.equal(result.expectedTrackCount, 3);
  assert.equal(result.expectedDurationSeconds, 390);
});

test('buildReleaseTracklistExpectations returns nulls for empty input', () => {
  const result = buildReleaseTracklistExpectations([]);
  assert.deepEqual(result.expectedTrackTitles, []);
  assert.equal(result.expectedTrackCount, null);
  assert.equal(result.expectedDurationSeconds, null);
});

test('buildReleaseTracklistExpectations tolerates non-array input', () => {
  const result = buildReleaseTracklistExpectations(null);
  assert.deepEqual(result.expectedTrackTitles, []);
  assert.equal(result.expectedTrackCount, null);
});
