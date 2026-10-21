import assert from 'node:assert/strict';
import test from 'node:test';
import { createMetadataTimestampFormatter, formatMetadataTimestamp } from '../../src/client/lib/metadata-timestamp-presentation.js';

const utc = createMetadataTimestampFormatter({ locales: 'en-GB', timeZone: 'UTC' });

test('metadata timestamps retain the exact machine instant and display an absolute date, seconds and offset', () => {
  const result = utc('2026-10-21T00:02:03.123Z');
  assert.equal(result.dateTime, '2026-10-21T00:02:03.123Z');
  assert.match(result.label, /^21 Oct 2026, 00:02:03 GMT(?:\+0)?$/u);
  assert.equal(formatMetadataTimestamp(result.dateTime).dateTime, result.dateTime);
});

test('explicit offsets and shorter fractions normalize to the same UTC instant', () => {
  assert.deepEqual(utc('2026-10-21T05:32:03.1+05:30'), utc('2026-10-21T00:02:03.100Z'));
  assert.deepEqual(utc('2026-10-20T20:02:03.12-04:00'), utc('2026-10-21T00:02:03.120Z'));
  assert.equal(utc('2026-10-21T00:02:03Z').dateTime, '2026-10-21T00:02:03.000Z');
});

test('a local timezone can cross a day boundary and distinguishes repeated daylight-saving times', () => {
  const local = createMetadataTimestampFormatter({ locales: 'en-GB', timeZone: 'America/New_York' });
  assert.equal(local('2026-10-21T00:02:03Z').label, '20 Oct 2026, 20:02:03 GMT-4');
  assert.equal(local('2026-11-01T05:30:00Z').label, '1 Nov 2026, 01:30:00 GMT-4');
  assert.equal(local('2026-11-01T06:30:00Z').label, '1 Nov 2026, 01:30:00 GMT-5');
});

test('locale presentation varies while the machine instant stays identical', () => {
  const german = createMetadataTimestampFormatter({ locales: 'de-DE', timeZone: 'UTC' });
  const value = '2026-10-21T00:02:03Z';
  assert.equal(german(value).dateTime, utc(value).dateTime);
  assert.notEqual(german(value).label, utc(value).label);
  assert.match(german(value).label, /Okt/u);
});

test('missing, malformed, impossible and zone-less timestamps never acquire a machine value', () => {
  const values = [undefined, null, '', ' ', 0, false, {}, new Date(), '2026-10-21', '2026-10-21T00:00:00', 'tomorrow', '<img src=x>',
    '2026-02-30T00:00:00Z', '2025-02-29T00:00:00Z', '2026-04-31T00:00:00Z', '2026-13-01T00:00:00Z', '2026-00-01T00:00:00Z',
    '2026-10-00T00:00:00Z', '2026-10-21T24:00:00Z', '2026-10-21T00:60:00Z', '2026-10-21T00:00:60Z', '0000-01-01T00:00:00Z',
    '2026-10-21T00:00:00+24:00', '2026-10-21T00:00:00+01:60', '2026-10-21T00:00:00.1234Z', '9999-12-31T23:59:59-01:00'];
  for (const value of values) assert.equal(utc(value), null);
});

test('calendar validation preserves leap days and never coerces non-string values', () => {
  assert.equal(utc('2024-02-29T12:00:00Z').dateTime, '2024-02-29T12:00:00.000Z');
  assert.equal(utc('0001-01-01T12:00:00Z').dateTime, '0001-01-01T12:00:00.000Z');
  assert.equal(utc({ toString() { throw new Error('Unexpected coercion'); } }), null);
});
