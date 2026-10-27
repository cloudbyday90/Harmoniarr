/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';
import { createPasswordWorkService } from '../../src/server/password-work-service.js';
import { currentPasswordHashProfile, legacyPasswordHashProfile, parsePasswordHash, needsPasswordHashUpgrade, isCurrentPasswordHash, formatCurrentPasswordHash } from '../../src/server/password-hash-policy.js';
import { hashPassword, verifyPassword } from '../../src/server/security.js';
import { assertPasswordInput } from '../../src/server/password-input-policy.js';
import { validatePassword } from '../../src/server/validators/auth-validator.js';

const stored = 'scrypt$' + 'a'.repeat(32) + '$' + '00'.repeat(64);

test('input admission accepts full ASCII/Unicode boundaries and rejects oversize without native dispatch', async () => {
  const seen = [], work = createPasswordWorkService({ deriveFn: async password => { seen.push(password); return Buffer.alloc(64); } });
  for (const password of ['x'.repeat(4096), '😀'.repeat(1024), ' a long password with spaces ', 'é'.repeat(2048)]) {
    assert.equal(validatePassword(password), password); assert.equal(assertPasswordInput(password), password);
    await work.hashPassword(password); assert.equal(seen.at(-1), password);
  }
  const admitted = seen.length;
  for (const password of ['x'.repeat(4097), '😀'.repeat(1024) + 'a', 'é'.repeat(2049)]) {
    assert.throws(() => validatePassword(password), { status: 400, code: 'validation_error' });
    await assert.rejects(work.hashPassword(password), { status: 400 });
    await assert.rejects(work.verifyPassword(password, stored), { status: 400 });
  }
  assert.equal(seen.length, admitted); assert.deepEqual(work.getState(), { active: 0, maxConcurrent: 2, pending: 0 });
});

test('hash and verification share two active slots, refuse excess without queueing and release after work settles', async () => {
  const gates = [], calls = [];
  const work = createPasswordWorkService({ deriveFn: (...args) => { calls.push(args); const gate = Promise.withResolvers(); gates.push(gate); return gate.promise; } });
  const first = work.hashPassword('FirstPassword123!'), second = work.verifyPassword('SecondPassword123!', stored);
  assert.deepEqual(work.getState(), { active: 2, maxConcurrent: 2, pending: 0 });
  await assert.rejects(work.hashPassword('RefusedPassword123!'), { status: 503, code: 'password_work_busy' });
  await assert.rejects(work.verifyPassword('RefusedPassword123!', stored), { status: 503, code: 'password_work_busy' });
  assert.equal(calls.length, 2); assert.equal(calls[0][2], 64); assert.deepEqual(calls[0][3], currentPasswordHashProfile.parameters);
  assert.deepEqual(calls[1][3], legacyPasswordHashProfile.parameters);
  gates[0].resolve(Buffer.alloc(64)); await first; assert.equal(work.getState().active, 1);
  gates[1].resolve(Buffer.alloc(64)); assert.equal(await second, true); assert.equal(work.getState().active, 0);
  assert.equal(work.getState().pending, 0);
});

test('native errors and malformed outputs release exactly once and preserve private causes', async () => {
  for (const cause of [new Error('private native error'), null]) {
    const work = createPasswordWorkService({ deriveFn: async () => { throw cause; } });
    await assert.rejects(work.hashPassword('Password123!'), error => error.code === 'password_work_unavailable' && error.cause === cause && !error.message.includes('private'));
    assert.equal(work.getState().active, 0);
  }
  const invalid = createPasswordWorkService({ deriveFn: async () => Buffer.alloc(3) });
  await assert.rejects(invalid.hashPassword('Password123!'), { code: 'password_work_unavailable' }); assert.equal(invalid.getState().active, 0);
});

test('malformed stored records consume no slot or KDF work', async () => {
  let calls = 0;
  const work = createPasswordWorkService({ deriveFn: async () => { calls++; return Buffer.alloc(64); } });
  for (const value of [null, '', 'scrypt$salt$hash', stored + '$extra', stored.replace('scrypt', 'bcrypt'), stored.slice(0, -1) + 'g', 'x'.repeat(100000)]) {
    assert.equal(await work.verifyPassword('Password123!', value), false);
  }
  assert.equal(calls, 0); assert.equal(work.getState().active, 0);
  assert.throws(() => createPasswordWorkService({ maxConcurrent: 3 }), TypeError);
});

test('real legacy scrypt records and full 64-character/Unicode passwords remain compatible', async () => {
  const password = '😀'.repeat(64) + ' with spaces ', salt = '0123456789abcdef0123456789abcdef';
  const key = await promisify(scryptCallback)(password, salt, 64);
  const legacy = `scrypt$${salt}$${key.toString('hex')}`;
  assert.equal(await verifyPassword(password, legacy), true);
  assert.equal(await verifyPassword(password + 'x', legacy), false);
  const current = await hashPassword(password); assert.equal(isCurrentPasswordHash(current), true);
  const parsed = parsePasswordHash(current);
  assert.equal(parsed.profile.parameters.p, 5);
  const oracle = await promisify(scryptCallback)(password, parsed.salt, 64, { N: 16384, r: 8, p: 5, maxmem: 33554432 });
  assert.equal(parsed.digest, oracle.toString('hex'));
  assert.equal(await verifyPassword(password, current), true); assert.equal(await verifyPassword(password.trim(), current), false);
});

test('version policy allowlists complete profiles and rejects attacker-selected KDF costs before admission', async () => {
  const current = formatCurrentPasswordHash('a'.repeat(32), Buffer.alloc(64));
  assert.equal(needsPasswordHashUpgrade(stored), true); assert.equal(needsPasswordHashUpgrade(current), false);
  assert.equal(isCurrentPasswordHash(stored), false);
  assert.equal(parsePasswordHash(stored).profile, legacyPasswordHashProfile);
  assert.equal(parsePasswordHash(current).profile, currentPasswordHashProfile);
  let calls = 0;
  const work = createPasswordWorkService({ deriveFn: async () => { calls++; return Buffer.alloc(64); } });
  for (const value of [current.replace('v2', 'v3'), current.replace('p=5', 'p=1'), current.replace('16384', '999999999'),
    current.replace('r=8', 'r=9'), current.replace('n=', 'N='), current + '$extra', current.slice(0, -1) + 'g',
    current + '\n', stored + '\n', 'scrypt$v2$' + 'x'.repeat(100000)]) {
    assert.equal(parsePasswordHash(value), null); assert.equal(needsPasswordHashUpgrade(value), false);
    assert.equal(await work.verifyPassword('Password123!', value), false);
  }
  assert.equal(calls, 0); assert.equal(work.getState().active, 0);
  assert.throws(() => formatCurrentPasswordHash('invalid', Buffer.alloc(64)), TypeError);
});
