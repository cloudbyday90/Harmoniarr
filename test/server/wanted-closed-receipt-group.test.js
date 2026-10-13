/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm, stat, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { captureClosedWantedReceiptGroup, WANTED_RECEIPT_GROUP_LIMIT } from '../../src/server/library/wanted-receipt-group-policy.js';
import { createWantedReceiptVerificationService } from '../../src/server/library/library-wanted-receipt-verification-service.js';
import { createWantedVerificationObserver } from '../../src/server/library/library-wanted-verification-observer.js';
import { fingerprintOperatorTrackFile } from '../../src/server/metadata/operator-track-file-evidence-service.js';
import { captureOperatorTrackFileStat } from '../../src/server/metadata/operator-track-fingerprint-policy.js';
import { createFixtureGate } from '../../testing/integration/fixture-lifecycle.js';

const evidence = { sizeBytes: 7, sha256: createHash('sha256').update('current').digest('hex') };
function rows() {
  const receipt = { version: 1, ownerId: 'owner', wantedReleaseId: 'wanted', sourceMediaRequestId: 'source',
    scope: { version: 1, mode: 'tracks', metadataReleaseId: 'release', tracks: [{ metadataTrackId: 'track',
      metadataReleaseId: 'release', recordingMbid: 'recording', title: 'Current', mediumPosition: 1, trackPosition: 1 }] },
    files: [{ libraryPath: '/private/current', evidence }] };
  return ['first', 'second', 'third'].map(importCandidateId => ({ ...structuredClone(receipt), importCandidateId }));
}
function controlled(extra = {}) {
  const records = []; const observer = createWantedVerificationObserver({ enabled: true, onRecord: r => records.push(r) });
  let roots = 0; let hashes = 0;
  const service = createWantedReceiptVerificationService({ allowGroupedReceipts: true,
    resolvePrivateTrackRoot: async () => { roots++; return '/private'; },
    fingerprintTrackFile: async () => { hashes++; return { ...evidence }; }, ...extra });
  return { observer, records, service, counts: () => ({ roots, hashes }) };
}

test('bounded exact capture retains every source identity and declines incompatible member bindings', () => {
  const input = rows(); const plan = captureClosedWantedReceiptGroup(input, 'owner');
  assert.deepEqual(plan, input); assert.notEqual(plan, input); assert.ok(Object.isFrozen(plan[0].files[0].evidence));
  input[0].scope.tracks[0].title = 'changed'; assert.equal(plan[0].scope.tracks[0].title, 'Current');
  for (const mutate of [r => { r.ownerId = 'other'; }, r => { r.wantedReleaseId = 'different'; },
    r => { r.scope.tracks[0].recordingMbid = 'different'; }, r => { r.files[0].libraryPath = '/other'; },
    r => { r.files[0].evidence.sha256 = '0'.repeat(64); }, r => { r.files.push(r.files[0]); },
    r => { delete r.wantedReleaseId; }, r => { r.files[0].evidence.extra = true; }]) {
    const pair = rows(); mutate(pair[1]); assert.equal(captureClosedWantedReceiptGroup(pair, 'owner'), null);
  }
});

test('receipt and JSON budgets decline whole batches without partial grouping or throwing private getters', () => {
  const base = rows()[0];
  assert.equal(captureClosedWantedReceiptGroup(Array.from({ length: WANTED_RECEIPT_GROUP_LIMIT + 1 }, () => base), 'owner'), null);
  for (const value of [undefined, 'x'.repeat(4097), Array(17).fill(0), new Date(), {}]) {
    const pair = rows(); pair[1].extra = value;
    if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) value.cycle = value;
    assert.equal(captureClosedWantedReceiptGroup(pair, 'owner'), null);
  }
  const pair = rows(); Object.defineProperty(pair[1], 'extra', { enumerable: true, get() { return assert.fail('No getter evaluated'); } });
  assert.equal(captureClosedWantedReceiptGroup(pair, 'owner'), null);
});

test('sparse or accessor-backed arrays cannot manufacture group members or evaluate input getters', () => {
  const sparse = Array(3); sparse[0] = rows()[0];
  assert.equal(captureClosedWantedReceiptGroup(sparse, 'owner'), null);
  const input = rows(); const track = input[1].scope.tracks[0]; let reads = 0;
  Object.defineProperty(input[1].scope.tracks, '0', { enumerable: true,
    get() { reads++; return track; } });
  assert.equal(captureClosedWantedReceiptGroup(input, 'owner'), null); assert.equal(reads, 0);
});

test('positive groups require two fresh hashes and two separate root reads per member', async () => {
  const c = controlled(); const input = rows();
  assert.deepEqual(await c.service.tryVerifyGroup({ receipts: input, ownerId: 'owner', observer: c.observer }),
    input.map(() => ({ eligible: true, available: true, currentRoot: '/private', missing: false })));
  assert.deepEqual(c.counts(), { roots: 6, hashes: 2 }); c.observer.finish('completed');
  assert.equal(c.records[0].counters.availableReceipts, 3); assert.equal(c.records[0].counters.fingerprintCalls, 2);
  assert.equal(c.records[0].counters.closedReceiptGroups, 1);
});

test('custom compatibility adapters stay serial unless grouping is explicitly selected', async () => {
  let calls = 0; const service = createWantedReceiptVerificationService({ fingerprintTrackFile: async () => { calls++; return evidence; } });
  assert.equal(await service.tryVerifyGroup({ receipts: rows(), ownerId: 'owner' }), null); assert.equal(calls, 0);
  assert.equal(await controlled().service.tryVerifyGroup({ receipts: [rows()[0]], ownerId: 'owner' }), null);
  assert.equal(await controlled().service.tryVerifyGroup({ receipts: rows().slice(0, 2), ownerId: 'owner' }), null);
  const rootAdapter = createWantedReceiptVerificationService({ resolvePrivateTrackRoot: () => assert.fail('Custom root stays serial') });
  assert.equal(await rootAdapter.tryVerifyGroup({ receipts: rows(), ownerId: 'owner' }), null);
});

test('opening missing/refused/mismatched evidence declines grouping and keeps individual current results', async () => {
  for (const code of ['ENOENT', 'ENOTDIR', 'operator_track_scope_verification_required', null]) {
    const c = controlled({ fingerprintTrackFile: async () => {
      if (code) throw Object.assign(new Error('private'), { code });
      return { ...evidence, sha256: '0'.repeat(64) };
    } });
    assert.equal(await c.service.tryVerifyGroup({ receipts: rows(), ownerId: 'owner', observer: c.observer }), null);
    const result = await c.service.verify({ receipt: rows()[0], ownerId: 'owner', observer: c.observer });
    assert.equal(result.available, false); assert.equal(result.missing, code === 'ENOENT');
  }
});

test('changed closing root, bytes or individual source identity refuses all grouped positives', async () => {
  for (const mode of ['root', 'bytes', 'source', 'closing_missing']) {
    const input = rows(); let roots = 0; let hashes = 0;
    const c = controlled({ resolvePrivateTrackRoot: async () => {
      roots++; if (mode === 'root' && roots > 3) return '/changed'; return '/private';
    }, fingerprintTrackFile: async () => {
      hashes++; if (mode === 'source' && hashes === 1) input[1].sourceMediaRequestId = 'replaced';
      if (mode === 'closing_missing' && hashes === 2) throw Object.assign(new Error('gone'), { code: 'ENOENT' });
      return mode === 'bytes' && hashes === 2 ? { ...evidence, sha256: '0'.repeat(64) } : evidence;
    } });
    await assert.rejects(c.service.tryVerifyGroup({ receipts: input, ownerId: 'owner' }), { code: 'library_wanted_projection_stale' });
  }
});

for (const reason of [new Error('original'), null]) {
  test(`opening/closing root failures retain original ${reason === null ? 'null' : 'Error'} without positive results`, async () => {
    for (const failureAt of [1, 4]) {
      let roots = 0;
      const c = controlled({ resolvePrivateTrackRoot: async () => { if (++roots === failureAt) throw reason; return '/private'; } });
      await assert.rejects(c.service.tryVerifyGroup({ receipts: rows(), ownerId: 'owner' }), error => error === reason);
    }
  });
  test(`unexpected ${reason === null ? 'null' : 'Error'} and held closing completion retain their exact owner`, async () => {
    const entered = createFixtureGate(); const held = createFixtureGate(); let hashes = 0; let settled = false;
    const c = controlled({ fingerprintTrackFile: async () => { if (++hashes === 2) {
      entered.release(); await held.promise; throw reason; } return evidence; } });
    const operation = c.service.tryVerifyGroup({ receipts: rows(), ownerId: 'owner' }).then(() => assert.fail(), error => {
      settled = true; assert.equal(error, reason);
    });
    try { await entered.promise; assert.equal(settled, false); } finally { held.release(); await operation; }
  });
}

test('actual same-size/same-time in-place mutation defeats metadata reuse and is refused by closing bytes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'harmoniarr-closed-receipts-'));
  try {
    const path = join(root, 'current'); await writeFile(path, 'current'); await utimes(path, 1_700_000_000, 1_700_000_000);
    const before = captureOperatorTrackFileStat(await stat(path)); let hashes = 0;
    const input = rows(); for (const row of input) row.files[0].libraryPath = path;
    const c = controlled({ resolvePrivateTrackRoot: async () => root,
      fingerprintTrackFile: async (file, options) => {
        const actual = await fingerprintOperatorTrackFile(file, options);
        if (++hashes === 1) {
          await writeFile(path, 'changed', { flag: 'r+' }); await utimes(path, 1_700_000_000, 1_700_000_000);
          assert.deepEqual(captureOperatorTrackFileStat(await stat(path)), before);
        }
        return actual;
      } });
    await assert.rejects(c.service.tryVerifyGroup({ receipts: input, ownerId: 'owner' }), { code: 'library_wanted_projection_stale' });
    assert.equal(hashes, 2);
    assert.notDeepEqual(await fingerprintOperatorTrackFile(path, { libraryRoot: root }), evidence);
  } finally { await rm(root, { recursive: true, force: true }); }
});
