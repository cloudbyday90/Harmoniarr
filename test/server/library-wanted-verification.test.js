/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { fingerprintOperatorTrackFile } from '../../src/server/metadata/operator-track-file-evidence-service.js';
import { createWantedVerificationObserver } from '../../src/server/library/library-wanted-verification-observer.js';
import { createWantedReceiptVerificationService } from '../../src/server/library/library-wanted-receipt-verification-service.js';

function observed(options = {}) {
  const records = []; const observer = createWantedVerificationObserver({ enabled: true, onRecord: record => records.push(record), ...options });
  return { observer, records, finish() { observer.finish('completed'); return records[0]; } };
}

test('the production diagnostic flag enables only the explicit opt-in value', () => {
  const previous = process.env.HARMONIARR_WANTED_VERIFICATION_DIAGNOSTICS;
  try {
    for (const flag of ['', '0', 'true', '1']) {
      process.env.HARMONIARR_WANTED_VERIFICATION_DIAGNOSTICS = flag;
      const records = []; const observer = createWantedVerificationObserver({ onRecord: record => records.push(record) });
      observer.finish('completed');
      assert.equal(observer.enabled, flag === '1'); assert.equal(records.length, flag === '1' ? 1 : 0);
    }
  } finally {
    if (previous === undefined) delete process.env.HARMONIARR_WANTED_VERIFICATION_DIAGNOSTICS;
    else process.env.HARMONIARR_WANTED_VERIFICATION_DIAGNOSTICS = previous;
  }
});

test('disabled diagnostics never call the clock or sink and preserve success and original Error/null', async () => {
  const observer = createWantedVerificationObserver({ enabled: false, now: () => assert.fail('Clock disabled'), onRecord: () => assert.fail('Sink disabled') });
  assert.equal(observer.enabled, false); observer.increment('hashedBytes', 100);
  const value = {}; assert.equal(await observer.measure('fingerprint', async () => value), value);
  for (const error of [new Error('Domain failure'), null]) {
    let caught = false;
    try { await observer.measure('fingerprint', async () => { throw error; }); }
    catch (actual) { caught = true; assert.equal(actual, error); }
    assert.equal(caught, true);
  }
  observer.finish('failed');
});

test('fixed diagnostic labels reject sensitive dimensions, saturate counts and emit one immutable bounded record', async () => {
  let time = 0; const value = observed({ now: () => { time += 1.125; return time; } });
  value.observer.increment('hashedBytes', Number.MAX_SAFE_INTEGER); value.observer.increment('hashedBytes', 9);
  for (const amount of [-1, NaN, Infinity, 1.2]) value.observer.increment('receiptRows', amount);
  value.observer.increment('/private/owner/candidate');
  await value.observer.measure('/private/hash/sql', async () => 'ignored');
  await value.observer.measure('reconciliation', () => value.observer.measure('fingerprint', async () => 42));
  const record = value.finish(); value.observer.finish('failed'); value.observer.increment('receiptRows');
  assert.equal(value.records.length, 1); assert.equal(record.counters.hashedBytes, Number.MAX_SAFE_INTEGER);
  assert.equal(record.counters.receiptRows, 0); assert.equal(record.clipped, true);
  assert.equal(record.phases.fingerprint.totalMs, 1.125); assert.equal(record.phases.reconciliation.totalMs, 3.375);
  assert.equal(Object.isFrozen(record.phases.fingerprint), true);
  assert.throws(() => { record.counters.hashedBytes = 0; }, TypeError);
  const json = JSON.stringify(record); assert.equal(json.includes('/private'), false); assert.ok(json.length < 2500);
  assert.match(record.correlationId, /^[0-9a-f-]{36}$/);
});

test('throwing, rejecting and unavailable diagnostic infrastructure preserves domain failures and values', async () => {
  for (const onRecord of [() => { throw new Error('Sink failure'); }, async () => { throw new Error('Sink rejection'); }]) {
    const observer = createWantedVerificationObserver({ enabled: true, now: () => { throw new Error('Clock failure'); }, onRecord });
    assert.equal(await observer.measure('reconciliation', async () => 'unchanged'), 'unchanged');
    for (const error of [new Error('Original'), null]) {
      let caught = false;
      try { await observer.measure('fingerprint', async () => { throw error; }); }
      catch (actual) { caught = true; assert.equal(actual, error); }
      assert.equal(caught, true);
    }
    observer.finish('failed');
  }
  const value = observed({ now: () => NaN }); await value.observer.measure('fingerprint', async () => true);
  assert.equal(value.finish().timingUnavailable, true);
  const backwards = observed({ now: (() => { let tick = 3; return () => tick--; })() });
  await backwards.observer.measure('fingerprint', async () => true);
  assert.equal(backwards.finish().phases.fingerprint.totalMs, 0);
  assert.equal(backwards.records[0].timingUnavailable, true);
});

test('fingerprinting counts actual bytes and diagnostic callbacks cannot change evidence or filesystem refusal', async () => {
  const root = await mkdtemp(join(tmpdir(), 'harmoniarr-byte-observation-'));
  try {
    const path = join(root, 'controlled.flac'); const bytes = Buffer.alloc(200_003, 97); await writeFile(path, bytes);
    const evidence = { sizeBytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
    let count = 0; assert.deepEqual(await fingerprintOperatorTrackFile(path, { libraryRoot: root, onBytesRead: amount => { count += amount; } }), evidence);
    assert.equal(count, bytes.length);
    for (const onBytesRead of [() => { throw new Error('Optional sink'); }, async () => { throw null; }]) {
      assert.deepEqual(await fingerprintOperatorTrackFile(path, { libraryRoot: root, onBytesRead }), evidence);
    }
    let refusedBytes = 0;
    await assert.rejects(fingerprintOperatorTrackFile(join(root, 'missing'), { onBytesRead: amount => { refusedBytes += amount; } }), { code: 'ENOENT' });
    assert.equal(refusedBytes, 0);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('receipt verification preserves eligibility, current-root ownership and fresh bytes on every call', async () => {
  const queryable = {}; const evidence = { sizeBytes: 17, sha256: 'controlled' };
  const receipt = { version: 1, ownerId: 'owner', wantedReleaseId: 'wanted', files: [{ libraryPath: '/private/file', evidence }] };
  let calls = 0; let current = evidence; const value = observed();
  const service = createWantedReceiptVerificationService({ resolvePrivateTrackRoot: async args => {
    assert.deepEqual(args, { ownerId: 'owner', queryable }); return '/private';
  }, fingerprintTrackFile: async (path, options) => {
    assert.equal(path, '/private/file'); assert.equal(options.libraryRoot, '/private'); calls++;
    options.onBytesRead(17); return current;
  } });
  assert.deepEqual(await service.verify({ receipt, ownerId: 'other', queryable, observer: value.observer }), { eligible: false });
  assert.equal((await service.verify({ receipt, ownerId: 'owner', queryable, observer: value.observer })).available, true);
  current = { ...evidence, sha256: 'replaced' };
  assert.equal((await service.verify({ receipt, ownerId: 'owner', queryable, observer: value.observer })).available, false);
  assert.equal(calls, 2); const record = value.finish();
  assert.equal(record.counters.hashedBytes, 34); assert.equal(record.counters.ineligibleReceipts, 1);
  assert.equal(record.counters.availableReceipts, 1); assert.equal(record.counters.mismatchedReceipts, 1);
});

test('receipt failures keep missing/refused semantics and count partial bytes without swallowing unexpected Error/null', async () => {
  const receipt = { version: 1, ownerId: 'owner', files: [{ libraryPath: '/private/file', evidence: {} }] };
  for (const code of ['ENOENT', 'ENOTDIR', 'operator_track_scope_verification_required']) {
    const value = observed(); const service = createWantedReceiptVerificationService({ fingerprintTrackFile: async (_path, options) => {
      options.onBytesRead(5); throw Object.assign(new Error('Private failure'), { code });
    } });
    const result = await service.verify({ receipt, ownerId: 'owner', observer: value.observer });
    assert.equal(result.available, false); assert.equal(result.missing, code === 'ENOENT');
    const record = value.finish(); assert.equal(record.counters.hashedBytes, 5);
    assert.equal(record.counters.fingerprintCompleted, 0); assert.equal(record.counters.fingerprintFailures, 1);
    assert.equal(record.counters[code === 'operator_track_scope_verification_required' ? 'refusedReceipts' : 'missingReceipts'], 1);
  }
  for (const error of [new Error('Real I/O failure'), null]) {
    const value = observed(); const service = createWantedReceiptVerificationService({ fingerprintTrackFile: async () => { throw error; } });
    let caught = false;
    try { await service.verify({ receipt, ownerId: 'owner', observer: value.observer }); }
    catch (actual) { caught = true; assert.equal(actual, error); }
    assert.equal(caught, true); assert.equal(value.finish().counters.unexpectedErrors, 1);
  }
});
