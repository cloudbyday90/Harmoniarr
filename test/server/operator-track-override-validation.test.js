/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createOperatorArtistSaveService } from '../../src/server/metadata/operator-artist-save-service.js';
import { defaultOperatorArtistMonitoringPolicy } from '../../src/server/metadata/operator-artist-monitoring-policy.js';
import {
  createOperatorTrackOverrideService,
  normalizeOperatorTrackOverridePatch,
} from '../../src/server/metadata/operator-track-override-service.js';

const TRACK_MBID = 'aabbccdd-1122-4334-8556-778899aabbcc';
const RECORDING_MBID = 'bbccddee-2233-1445-8667-8899aabbccdd';
const RELEASE_ID = 'ccddeeff-3344-7556-8778-99aabbccddee';
const RELEASE_GROUP_ID = 'ddeeffaa-4455-4667-8889-aabbccddeeff';
const INTEGER_MAX = 2_147_483_647;
const uuidFields = ['trackMbid', 'recordingMbid', 'metadataReleaseId'];
const integerFields = ['mediumPosition', 'trackPosition', 'trackLengthMsSnapshot'];

function validOverride() {
  return {
    isDesired: false,
    trackMbid: TRACK_MBID,
    recordingMbid: RECORDING_MBID,
    metadataReleaseId: RELEASE_ID,
    mediumPosition: 1,
    trackPosition: 2,
    trackLengthMsSnapshot: 0,
  };
}

function assertInvalidField(patch, field) {
  assert.throws(() => normalizeOperatorTrackOverridePatch(patch), {
    code: 'validation_error',
    status: 400,
    message: new RegExp(`^${field} must be `),
  });
}

test('track override integers preserve exact PostgreSQL bounds and optional absence', () => {
  const result = normalizeOperatorTrackOverridePatch({
    ...validOverride(),
    mediumPosition: INTEGER_MAX,
    trackPosition: INTEGER_MAX,
    trackLengthMsSnapshot: INTEGER_MAX,
  });
  for (const field of integerFields) assert.equal(result[field], INTEGER_MAX);
  assert.equal(normalizeOperatorTrackOverridePatch(validOverride()).trackLengthMsSnapshot, 0);

  for (const absent of [null, undefined]) {
    const optional = normalizeOperatorTrackOverridePatch({
      ...validOverride(), mediumPosition: absent, trackPosition: absent, trackLengthMsSnapshot: absent,
    });
    for (const field of integerFields) assert.equal(optional[field], null);
  }
  for (const field of ['mediumPosition', 'trackPosition']) {
    assertInvalidField({ ...validOverride(), [field]: 0 }, field);
  }
});

test('track override integers reject coercion, truncation, non-finite values and database overflow', () => {
  const coercionTrap = {
    toString() { assert.fail('Track validation must not stringify an input object'); },
    valueOf() { assert.fail('Track validation must not coerce an input object'); },
  };
  const invalidValues = [
    '2', '2x', '2.5', '2e3', '', ' ', true, false, [2], {}, coercionTrap,
    2n, Symbol('track-position'), 0.5, -1, NaN, Infinity, -Infinity,
    INTEGER_MAX + 1, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 1,
  ];
  for (const field of integerFields) {
    for (const value of invalidValues) assertInvalidField({ ...validOverride(), [field]: value }, field);
  }
});

test('track override UUIDs normalize case and whitespace without changing identity or input', () => {
  const input = Object.freeze({
    ...validOverride(),
    trackMbid: ` ${TRACK_MBID.toUpperCase()} `,
    recordingMbid: `\t${RECORDING_MBID.toUpperCase()}\n`,
    metadataReleaseId: RELEASE_ID.toUpperCase(),
  });
  const result = normalizeOperatorTrackOverridePatch(input);
  assert.equal(result.trackMbid, TRACK_MBID);
  assert.equal(result.recordingMbid, RECORDING_MBID);
  assert.equal(result.metadataReleaseId, RELEASE_ID);
  assert.equal(input.trackMbid, ` ${TRACK_MBID.toUpperCase()} `);

  for (const absent of [null, undefined]) {
    const optional = normalizeOperatorTrackOverridePatch({
      ...validOverride(), recordingMbid: absent, metadataReleaseId: absent,
    });
    assert.equal(optional.recordingMbid, null);
    assert.equal(optional.metadataReleaseId, null);
    const fallback = normalizeOperatorTrackOverridePatch({ ...validOverride(), trackMbid: absent });
    assert.equal(fallback.trackMbid, null);
    assert.equal(fallback.recordingMbid, RECORDING_MBID);
    assert.equal(fallback.mediumPosition, 1);
    assert.equal(fallback.trackPosition, 2);
  }
});

test('invalid supplied UUIDs cannot disappear into another valid track identity', () => {
  const invalidValues = [
    '', ' ', false, 123, {}, [TRACK_MBID], new String(TRACK_MBID),
    `{${TRACK_MBID}}`, TRACK_MBID.replaceAll('-', ''), `urn:uuid:${TRACK_MBID}`,
    `${TRACK_MBID}/extra`, `x${TRACK_MBID.slice(1)}`, TRACK_MBID.slice(1),
  ];
  for (const field of uuidFields) {
    for (const value of invalidValues) assertInvalidField({ ...validOverride(), [field]: value }, field);
  }
});

test('track override validation retains paired positions and complete recording fallback requirements', () => {
  for (const patch of [
    { trackMbid: null, recordingMbid: null },
    { trackMbid: null, mediumPosition: null, trackPosition: null },
    { mediumPosition: null },
    { trackPosition: null },
  ]) {
    assert.throws(() => normalizeOperatorTrackOverridePatch({ ...validOverride(), ...patch }), {
      code: 'validation_error', status: 400,
    });
  }
});

test('canonical artist save rejects malformed track identities before acquiring persistence', async (t) => {
  const getPoolFn = t.mock.fn(() => assert.fail('Invalid track overrides must not acquire persistence'));
  const service = createOperatorArtistSaveService({ getPoolFn, getOperatorArtistProjection: async () => null });
  const save = (trackOverrides) => service.saveOperatorArtist({
    appUserId: 'operator-1',
    metadataArtistId: 'artist-1',
    expectedSnapshotRevision: 0,
    draft: {
      monitoring: { ...defaultOperatorArtistMonitoringPolicy, isMonitored: true },
      releaseGroupSelections: [],
      trackOverrides,
    },
  });
  for (const patch of [
    { mediumPosition: '1x' }, { trackPosition: 1.5 }, { trackLengthMsSnapshot: INTEGER_MAX + 1 },
    { trackMbid: false }, { recordingMbid: [] }, { metadataReleaseId: 'invalid-uuid' },
  ]) {
    await assert.rejects(save([{ metadataReleaseGroupId: RELEASE_GROUP_ID, ...validOverride(), ...patch }]), {
      code: 'validation_error', status: 400,
    });
  }
  await assert.rejects(save([
    { metadataReleaseGroupId: RELEASE_GROUP_ID, ...validOverride() },
    { metadataReleaseGroupId: RELEASE_GROUP_ID, ...validOverride(), trackMbid: ` ${TRACK_MBID.toUpperCase()} ` },
  ]), {
    code: 'validation_error', status: 400, message: /Duplicate track override identity/,
  });
  const fallback = { metadataReleaseGroupId: RELEASE_GROUP_ID, ...validOverride(), trackMbid: null };
  await assert.rejects(save([
    fallback,
    { ...fallback, recordingMbid: RECORDING_MBID.toUpperCase(), metadataReleaseId: ` ${RELEASE_ID.toUpperCase()} ` },
  ]), {
    code: 'validation_error', status: 400, message: /Duplicate track override identity/,
  });
  assert.equal(getPoolFn.mock.callCount(), 0);
});

test('direct track override writes validate identity before accessing the database', async (t) => {
  const getPoolFn = t.mock.fn(() => assert.fail('Invalid track override must not access the database'));
  const upsertOperatorTrackOverride = t.mock.fn(() => assert.fail('Invalid track override must not persist'));
  const service = createOperatorTrackOverrideService({
    getPoolFn, operatorTrackOverrideStore: { upsertOperatorTrackOverride },
  });
  for (const patch of [{ trackMbid: false }, { mediumPosition: '1x' }]) {
    await assert.rejects(service.updateOperatorTrackOverride({
      appUserId: 'operator-1', metadataArtistId: 'artist-1', metadataReleaseGroupId: RELEASE_GROUP_ID,
      patch: { ...validOverride(), ...patch },
    }), { code: 'validation_error', status: 400 });
  }
  assert.equal(getPoolFn.mock.callCount(), 0);
  assert.equal(upsertOperatorTrackOverride.mock.callCount(), 0);
});
