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
  filterSlskdResponsesForCandidates,
  isUsernameIgnored,
  matchBlacklistedTerm,
  normalizeBlacklistTerms,
  normalizeIgnoredUsernames,
} from '../../src/server/library/candidate-source-filter.js';

test('normalizeIgnoredUsernames lowercases, trims, and deduplicates from arrays and strings', () => {
  const fromArray = normalizeIgnoredUsernames(['  BadActor ', 'badactor', 'Other']);
  assert.deepEqual([...fromArray].sort(), ['badactor', 'other']);

  const fromString = normalizeIgnoredUsernames('BadActor, badactor ,Other');
  assert.deepEqual([...fromString].sort(), ['badactor', 'other']);

  assert.equal(normalizeIgnoredUsernames(null).size, 0);
  assert.equal(normalizeIgnoredUsernames(42).size, 0);
});

test('normalizeBlacklistTerms lowercases, trims, deduplicates, and ignores non-strings', () => {
  assert.deepEqual(
    normalizeBlacklistTerms(['Karaoke', ' karaoke ', 'Live', 42, null]),
    ['karaoke', 'live'],
  );
  assert.deepEqual(normalizeBlacklistTerms('karaoke , live,'), ['karaoke', 'live']);
  assert.deepEqual(normalizeBlacklistTerms(null), []);
});

test('isUsernameIgnored is case-insensitive and safe against non-string input', () => {
  const ignored = normalizeIgnoredUsernames(['BadActor']);
  assert.equal(isUsernameIgnored('badactor', ignored), true);
  assert.equal(isUsernameIgnored('  BADACTOR ', ignored), true);
  assert.equal(isUsernameIgnored('goodactor', ignored), false);
  assert.equal(isUsernameIgnored(null, ignored), false);
  assert.equal(isUsernameIgnored('badactor', new Set()), false);
});

test('matchBlacklistedTerm finds case-insensitive substring matches in remote paths', () => {
  const terms = normalizeBlacklistTerms(['karaoke', 'live']);
  assert.equal(matchBlacklistedTerm('Artist\\Album (Karaoke)\\01.mp3', terms), 'karaoke');
  assert.equal(matchBlacklistedTerm('Artist\\Live At Wembley\\01.flac', terms), 'live');
  assert.equal(matchBlacklistedTerm('Artist\\Album\\01.flac', terms), null);
  assert.equal(matchBlacklistedTerm(null, terms), null);
  assert.equal(matchBlacklistedTerm('anything', []), null);
});

test('filterSlskdResponsesForCandidates is a structural no-op with no filters configured', () => {
  const responses = [{ username: 'user', files: [{ filename: 'a.flac' }] }];
  const result = filterSlskdResponsesForCandidates({ responses });
  assert.equal(result.responses, responses);
  assert.deepEqual(result.summary, {
    blacklistedFileCount: 0,
    ignoredUserResponseCount: 0,
    emptyResponseCount: 0,
  });
});

test('filterSlskdResponsesForCandidates drops ignored uploaders entirely', () => {
  const responses = [
    { username: 'BadActor', files: [{ filename: 'a.flac' }] },
    { username: 'GoodUser', files: [{ filename: 'b.flac' }] },
  ];
  const result = filterSlskdResponsesForCandidates({
    responses,
    ignoredUsernames: ['badactor'],
  });
  assert.equal(result.responses.length, 1);
  assert.equal(result.responses[0].username, 'GoodUser');
  assert.equal(result.summary.ignoredUserResponseCount, 1);
});

test('filterSlskdResponsesForCandidates removes blacklisted files and drops empty responses', () => {
  const responses = [
    {
      username: 'GoodUser',
      files: [
        { filename: 'Artist\\Album\\01 Real.flac' },
        { filename: 'Artist\\Album (Karaoke)\\02 Fake.mp3' },
      ],
      lockedFiles: [{ filename: 'Artist\\Live Bootleg\\03.mp3' }],
    },
    {
      username: 'AllJunk',
      files: [{ filename: 'Artist\\Karaoke Hits\\01.mp3' }],
    },
  ];
  const result = filterSlskdResponsesForCandidates({
    responses,
    blacklistedTitleTerms: ['karaoke', 'live'],
  });

  assert.equal(result.responses.length, 1);
  assert.equal(result.responses[0].username, 'GoodUser');
  assert.equal(result.responses[0].files.length, 1);
  assert.equal(result.responses[0].files[0].filename, 'Artist\\Album\\01 Real.flac');
  assert.equal(result.responses[0].lockedFiles.length, 0);
  assert.equal(result.summary.blacklistedFileCount, 3);
  assert.equal(result.summary.emptyResponseCount, 1);
});

test('filterSlskdResponsesForCandidates tolerates hostile and malformed input', () => {
  assert.deepEqual(
    filterSlskdResponsesForCandidates({ responses: null }).responses,
    [],
  );
  const hostile = [
    { username: 'x', files: 'not-an-array', lockedFiles: null },
    { username: null, files: [{ filename: 'a.flac' }] },
  ];
  const result = filterSlskdResponsesForCandidates({
    responses: hostile,
    ignoredUsernames: ['ignored'],
    blacklistedTitleTerms: ['junk'],
  });
  // First response has no usable files -> dropped as empty; second has a clean file.
  assert.equal(result.responses.length, 1);
  assert.equal(result.responses[0].files[0].filename, 'a.flac');
});
