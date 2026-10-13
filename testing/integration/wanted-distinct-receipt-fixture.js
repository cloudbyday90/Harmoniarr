/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createOperatorTrackOverrideStore } from '../../src/server/metadata/operator-track-override-store.js';
import { wantedDistinctReceiptsPerBinding } from './wanted-distinct-binding-policy.js';

export async function validateWantedDistinctReceipts({ pool, files, bindings, signal }) {
  const stats = [];
  for (const path of files) { signal?.throwIfAborted(); stats.push(await stat(path)); }
  assert.equal(files.length, bindings); assert.equal(new Set(files).size, bindings);
  assert.equal(new Set(stats.map(info => JSON.stringify([info.dev, info.ino]))).size, bindings);
  assert.ok(stats.every(info => info.isFile() && info.size > 0));
  const scopes = (await createOperatorTrackOverrideStore({ getPoolFn: () => pool }).listOperatorTrackOverridesSnapshot())
    .filter(row => row.isDesired && row.remapStatus === 'resolved');
  const scopeKey = (ownerId, releaseId, recording, medium, position) => JSON.stringify([ownerId, releaseId, recording, medium, position]);
  const saved = new Set(scopes.map(row => scopeKey(row.appUserId, row.metadataReleaseId, row.recordingMbid, row.mediumPosition, row.trackPosition)));
  assert.equal(scopes.length, bindings); assert.equal(saved.size, bindings);
  const receipts = (await pool.query('SELECT app_user_id,metadata_release_id,receipt FROM operator_track_receipts')).rows;
  assert.equal(receipts.length, bindings * wantedDistinctReceiptsPerBinding);
  assert.equal(new Set(receipts.map(row => row.app_user_id)).size, 2);
  assert.equal(new Set(receipts.map(row => row.metadata_release_id)).size, bindings / 2);
  assert.deepEqual(new Set(receipts.map(row => resolve(row.receipt.files[0].libraryPath))), new Set(files.map(path => resolve(path))));
  const groups = new Map();
  for (const row of receipts) {
    assert.equal(row.receipt.files.length, 1);
    assert.equal(row.receipt.ownerId, row.app_user_id); assert.equal(row.receipt.scope.metadataReleaseId, row.metadata_release_id);
    assert.equal(row.receipt.scope.tracks.length, 1);
    const track = row.receipt.scope.tracks[0];
    assert.ok(saved.has(scopeKey(row.app_user_id, row.metadata_release_id, track.recordingMbid, track.mediumPosition, track.trackPosition)));
    const key = JSON.stringify([row.app_user_id, row.metadata_release_id, row.receipt.scope, row.receipt.files[0].libraryPath]);
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }
  assert.equal(groups.size, bindings); assert.ok([...groups.values()].every(count => count === wantedDistinctReceiptsPerBinding));
  signal?.throwIfAborted();
  return { stats, scopes, receipts };
}
