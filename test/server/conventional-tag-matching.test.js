import assert from 'node:assert/strict';
import test from 'node:test';
import {
  artistTokensOverlap,
  findConventionalTagMatches,
  getConventionalArtist,
  normalizeConventionalTitle,
  normalizeMatchText,
} from '../../src/server/library/conventional-tag-matching.js';

test('normalizeMatchText folds case, accents, and punctuation for tag comparison', () => {
  assert.equal(normalizeMatchText('  Bjork - Joga!!! '), 'bjork joga');
  assert.equal(normalizeMatchText('Autechre'), 'autechre');
  assert.equal(normalizeMatchText(null), null);
});

test('normalizeConventionalTitle strips common credit and edition suffixes', () => {
  assert.equal(normalizeConventionalTitle('Windowlicker (feat. Example Artist)'), 'windowlicker');
  assert.equal(normalizeConventionalTitle('Foil - ft. Guest'), 'foil');
  assert.equal(normalizeConventionalTitle('Arch Carrier [Remastered 2024]'), 'arch carrier');
});

test('artistTokensOverlap accepts useful shared artist tokens without exact names', () => {
  assert.equal(artistTokensOverlap('The Beatles', 'Beatles, The'), true);
  assert.equal(artistTokensOverlap('RADIOHEAD', 'Radiohead'), true);
  assert.equal(artistTokensOverlap('Various Artists', 'Autechre'), false);
});

test('getConventionalArtist falls back past blank artist fields', () => {
  assert.equal(getConventionalArtist({
    albumArtist: '   ',
    artist: 'Autechre',
    artists: ['Other'],
  }), 'Autechre');
});

test('findConventionalTagMatches prefers album-narrowed global matches when available', () => {
  const result = findConventionalTagMatches({
    candidates: [
      {
        metadataReleaseId: 'release-1',
        releaseArtistName: 'Autechre',
        releaseTitle: 'Amber',
        trackPosition: 1,
        trackTitle: 'Foil',
      },
      {
        metadataReleaseId: 'release-2',
        releaseArtistName: 'Autechre',
        releaseTitle: 'Live Archive',
        trackPosition: 1,
        trackTitle: 'Foil',
      },
    ],
    normalizedTags: {
      album: 'Amber',
      albumArtist: 'Autechre',
      title: 'Foil',
      track: { number: 1 },
    },
  });

  assert.deepEqual(result.globalMatches.map((candidate) => candidate.metadataReleaseId), ['release-1']);
  assert.equal(result.normalizedAlbum, 'amber');
  assert.equal(result.normalizedArtist, 'autechre');
  assert.equal(result.normalizedTitle, 'foil');
});

test('findConventionalTagMatches returns no matches when title or integer position is missing', () => {
  const result = findConventionalTagMatches({
    candidates: [],
    normalizedTags: {
      albumArtist: 'Autechre',
      title: null,
      track: { number: 1 },
    },
  });

  assert.equal(result.reason, 'missing_title_or_track_position');
  assert.deepEqual(result.globalMatches, []);
  assert.deepEqual(result.scopeMatches, []);
});
