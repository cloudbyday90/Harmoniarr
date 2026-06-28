import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeMetadataReleaseDateForDateColumn,
  parseMetadataReleaseDateInstant,
} from '../../src/server/metadata/metadata-release-date-normalization.js';

test('normalizeMetadataReleaseDateForDateColumn expands MusicBrainz partial dates', () => {
  assert.equal(normalizeMetadataReleaseDateForDateColumn('2000'), '2000-01-01');
  assert.equal(normalizeMetadataReleaseDateForDateColumn('2000-07'), '2000-07-01');
  assert.equal(normalizeMetadataReleaseDateForDateColumn('2000-07-14'), '2000-07-14');
});

test('normalizeMetadataReleaseDateForDateColumn rejects invalid calendar dates', () => {
  assert.equal(normalizeMetadataReleaseDateForDateColumn('2000-13'), null);
  assert.equal(normalizeMetadataReleaseDateForDateColumn('2000-02-31'), null);
  assert.equal(normalizeMetadataReleaseDateForDateColumn('not-a-date'), null);
});

test('parseMetadataReleaseDateInstant returns UTC midnight for normalized metadata dates', () => {
  assert.equal(
    parseMetadataReleaseDateInstant('2000-07')?.toISOString(),
    '2000-07-01T00:00:00.000Z',
  );
});
