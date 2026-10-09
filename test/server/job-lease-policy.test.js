/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { normalizeExpectedJobLease, isCurrentJobLeaseAcquisition } from '../../src/server/job-lease-policy.js';

const leaseKey = 'library_scan:run-1';
const now = Date.parse('2026-10-09T21:00:00.000Z');
const fixture = () => ({ leaseKey, ownerInstanceId: 'pid:44', acquisitionId: randomUUID(),
  id: 'stable-row', acquiredAt: '2026-10-09T20:59:00.000Z',
  expiresAt: '2026-10-09T21:01:00.000Z', releasedAt: null });

test('capture freezes a separate identity and cannot acquire later authority through input mutation', () => {
  const input = fixture();
  const expected = normalizeExpectedJobLease(input);
  assert.equal(Object.isFrozen(expected), true);
  assert.notEqual(expected, input);
  assert.deepEqual(Object.keys(expected).sort(), ['acquisitionId', 'leaseKey', 'ownerInstanceId']);
  const original = structuredClone(expected);
  input.acquisitionId = randomUUID();
  input.ownerInstanceId = 'new-owner';
  assert.deepEqual(expected, original);
  assert.equal(isCurrentJobLeaseAcquisition(input, expected, { now }), false);
  assert.throws(() => { expected.acquisitionId = randomUUID(); }, TypeError);
});

test('missing/malformed tokens, ownership, keys and explicit wrong-key captures fail closed', () => {
  for (const expected of [null, [], {}, { ...fixture(), acquisitionId: undefined }, { ...fixture(), acquisitionId: null },
    { ...fixture(), acquisitionId: 'row-id' }, { ...fixture(), acquisitionId: 'ABCDEFAB-1234-4123-8123-ABCDEFABCDEF' },
    { ...fixture(), ownerInstanceId: '' }, { ...fixture(), ownerInstanceId: 'x'.repeat(513) },
    { ...fixture(), leaseKey: '' }, { ...fixture(), leaseKey: String.fromCharCode(0) }]) {
    assert.equal(normalizeExpectedJobLease(expected), null);
    assert.equal(isCurrentJobLeaseAcquisition(fixture(), expected, { now }), false);
  }
  assert.equal(normalizeExpectedJobLease(fixture(), { leaseKey: 'another:run' }), null);
});

test('same row/key/PID/millisecond timestamp with a new token is a different acquisition', () => {
  const original = fixture();
  const receipt = normalizeExpectedJobLease(original);
  const replacement = { ...original, acquisitionId: randomUUID() };
  assert.equal(isCurrentJobLeaseAcquisition(original, receipt, { now }), true);
  assert.equal(isCurrentJobLeaseAcquisition(replacement, receipt, { now }), false);
  assert.equal(isCurrentJobLeaseAcquisition({ ...original, ownerInstanceId: 'other' }, receipt, { now }), false);
  assert.equal(isCurrentJobLeaseAcquisition(original, receipt, { leaseKey: 'wrong:key', now }), false);
});

test('renewal keeps its acquisition identity but released/expired/malformed rows cannot be current', () => {
  const original = fixture();
  const receipt = normalizeExpectedJobLease(original);
  assert.equal(isCurrentJobLeaseAcquisition({ ...original, expiresAt: '2026-10-09T22:00:00.000Z' }, receipt, { now }), true);
  for (const change of [{ releasedAt: '2026-10-09T20:59:59.000Z' }, { releasedAt: false },
    { expiresAt: new Date(now + 1000).toISOString() }, { expiresAt: new Date(now).toISOString() },
    { expiresAt: 'not-a-clock' }, { expiresAt: null }, { acquisitionId: null }]) {
    const current = { ...original, ...change };
    assert.equal(isCurrentJobLeaseAcquisition(current, receipt, { now: now + 1000 }), false);
  }
});

test('expired release authority still needs the exact unreleased token and valid expiry', () => {
  const expired = { ...fixture(), expiresAt: '2026-10-09T20:59:59.000Z' };
  const receipt = normalizeExpectedJobLease(expired);
  assert.equal(isCurrentJobLeaseAcquisition(expired, receipt, { now, allowExpired: true }), true);
  for (const change of [{ acquisitionId: randomUUID() }, { releasedAt: expired.expiresAt }, { expiresAt: 'invalid' }]) {
    assert.equal(isCurrentJobLeaseAcquisition({ ...expired, ...change }, receipt, { now, allowExpired: true }), false);
  }
});

test('an unverifiable clock never grants live or expired acquisition authority', () => {
  const current = fixture();
  const expected = normalizeExpectedJobLease(current);
  for (const invalidNow of [null, false, '', '0', [], {}, Number.NaN, Infinity, new Date(now)]) {
    for (const allowExpired of [false, true]) {
      assert.equal(isCurrentJobLeaseAcquisition(current, expected, { now: invalidNow, allowExpired }), false,
        'invalid clock ' + String(invalidNow));
    }
  }
});
