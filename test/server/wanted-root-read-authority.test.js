/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { validWantedRootReadProof } from '../../src/server/library/wanted-root-read-authority-policy.js';
import { withWantedRootReadAuthority, wantedRootReadTransaction } from '../../src/server/library/wanted-root-read-authority-service.js';
import { createOperatorTrackRootContextStore } from '../../src/server/metadata/operator-track-root-context-store.js';
import { createWantedClosedReceiptGroupService } from '../../src/server/library/wanted-closed-receipt-group-service.js';
import { disabledWantedVerificationObserver } from '../../src/server/library/library-wanted-verification-observer.js';

function proof() {
  const body = readFileSync(new URL('../../src/server/migrations/20261013_155026_wanted_root_authority_coordination.sql', import.meta.url), 'utf8')
    .split(' AS $$')[1].split('$$;')[0];
  return ['app_users', 'app_settings'].map(table_name => ({ table_name, trigger_name: `${table_name}_root_authority_admission`,
    enabled: 'O', trigger_type: 30, unconditional: true, columns: table_name === 'app_users' ? ['id', 'is_disabled', 'managed_library_relative_root'] : [],
    function_schema: 'public', function_name: 'harmoniarr_root_authority_admission', language: 'plpgsql', security_definer: false,
    volatility: 'v', function_config: ['search_path=pg_catalog'], function_body: body, held_authority: true, origin_mode: true,
    read_committed: true, transaction_id: '101' }));
}

test('runtime proof declines missing, altered or bypassed guards and transaction authority', () => {
  assert.equal(validWantedRootReadProof(proof()), true);
  for (const [key, value] of Object.entries({ enabled: 'D', trigger_type: 31, unconditional: false, columns: [], security_definer: true,
    function_body: 'RETURN NULL;', held_authority: false, origin_mode: false, read_committed: false,
    transaction_id: null, function_config: ['search_path=public'], language: 'sql', volatility: 's' })) {
    const rows = proof(); rows[0][key] = value; assert.equal(validWantedRootReadProof(rows), false, key);
  }
  assert.equal(validWantedRootReadProof(proof().slice(0, 1)), false);
  assert.equal(validWantedRootReadProof([null, null]), false);
  const rows = proof(); rows[1] = rows[0]; assert.equal(validWantedRootReadProof(rows), false);
});

test('tokens bind exact queryable/invocation, reject fabrication and expire after success or original Error/null', async () => {
  for (const primary of [undefined, new Error('original'), null]) {
    const queryable = { query: async () => ({ rows: proof() }) }; let captured;
    const pending = withWantedRootReadAuthority({ queryable }, async authority => {
      captured = authority; assert.equal(wantedRootReadTransaction(authority, queryable), '101');
      assert.equal(wantedRootReadTransaction({ ...authority }, queryable), null);
      assert.equal(wantedRootReadTransaction(authority, { ...queryable }), null);
      if (primary !== undefined) throw primary;
      return 'done';
    });
    if (primary !== undefined) await assert.rejects(pending, error => error === primary);
    else assert.equal(await pending, 'done');
    assert.equal(wantedRootReadTransaction(captured, queryable), null);
  }
  assert.equal(wantedRootReadTransaction(undefined, undefined), null);
});

test('a changed transaction refuses even when the owner is absent, without minting partial authority', async () => {
  const store = createOperatorTrackRootContextStore();
  for (const id of ['owner', null]) await assert.rejects(store.readOwnerRootContext({ ownerId: 'owner', expectedTransactionId: '101',
    queryable: { query: async () => ({ rows: [{ id, transaction_id: '102' }] }) } }), { code: 'library_wanted_projection_stale' });
  let entered = false;
  await assert.rejects(withWantedRootReadAuthority({ queryable: { query: async () => ({ rows: [] }) } }, () => { entered = true; }),
    { code: 'library_wanted_projection_stale' }); assert.equal(entered, false);
});

test('bounded groups close twice without sharing roots across invocation and decline missing tokens', async () => {
  const receipt = { version: 1, ownerId: 'owner', wantedReleaseId: 'wanted', sourceMediaRequestId: 'source',
    scope: { version: 1, mode: 'tracks', metadataReleaseId: 'release', tracks: [{ metadataTrackId: 'track', metadataReleaseId: 'release',
      recordingMbid: 'recording', title: 'Current', mediumPosition: 1, trackPosition: 1 }] },
    files: [{ libraryPath: '/private/current', evidence: { sizeBytes: 1, sha256: 'a'.repeat(64) } }] };
  const receipts = ['one', 'two', 'three'].map(importCandidateId => ({ ...structuredClone(receipt), importCandidateId }));
  const queryable = { query: async () => ({ rows: proof() }) }; let roots = 0; let hashes = 0;
  const service = createWantedClosedReceiptGroupService({ readRoot: async () => { roots++; return '/private'; },
    fingerprint: async () => { hashes++; return receipt.files[0].evidence; } });
  const input = { receipts, ownerId: 'owner', queryable, observer: disabledWantedVerificationObserver, enabled: true, allowBoundedRoots: true };
  for (let index = 0; index < 2; index++) await withWantedRootReadAuthority({ queryable }, rootReadAuthority => service.tryVerifyGroup({ ...input, rootReadAuthority }));
  assert.equal(roots, 4); assert.equal(hashes, 4);
  await service.tryVerifyGroup({ ...input, rootReadAuthority: {} }); assert.equal(roots, 10); assert.equal(hashes, 6);
  let entered; let release; let pending; let reads = 0;
  const ready = new Promise(resolve => { entered = resolve; }); const held = new Promise(resolve => { release = resolve; });
  const delayed = createWantedClosedReceiptGroupService({ readRoot: async () => '/private', fingerprint: async () => {
    if (++reads === 2) { entered(); await held; } return receipt.files[0].evidence;
  } });
  await withWantedRootReadAuthority({ queryable }, rootReadAuthority => {
    pending = delayed.tryVerifyGroup({ ...input, rootReadAuthority }); void pending.catch(() => {}); return ready;
  });
  release(); await assert.rejects(pending, { code: 'library_wanted_projection_stale' });
});
