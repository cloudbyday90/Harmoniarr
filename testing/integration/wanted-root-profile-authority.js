/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import { createOperatorTrackDeliveryPlanService } from '../../src/server/metadata/operator-track-delivery-plan-service.js';
import { createLibraryWantedReleaseReader } from '../../src/server/library/library-wanted-release-reader.js';
import { createLibraryWantedReleaseService } from '../../src/server/library/library-wanted-release-service.js';

/** Shared by routine correctness and the full benchmark's original first scenario. */
export async function assertWantedRootProfileAuthority(c) {
  const root = createOperatorTrackDeliveryPlanService({ useCombinedRootRead: true });
  const ownerId = c.preview.files[0].delivery.ownerId;
  const original = (await c.pool.query("SELECT setting_value FROM app_settings WHERE namespace='paths' AND setting_key='music'")).rows[0].setting_value;
  await c.pool.query("UPDATE app_settings SET setting_value='null'::jsonb WHERE namespace='paths' AND setting_key='music'");
  await assert.rejects(root.resolvePrivateOwnerRoot({ ownerId }), { code: 'operator_track_scope_verification_required' });
  await c.pool.query("DELETE FROM app_settings WHERE namespace='paths' AND setting_key='music'");
  const legacy = createOperatorTrackDeliveryPlanService({ useCombinedRootRead: false });
  assert.equal(await root.resolvePrivateOwnerRoot({ ownerId }), await legacy.resolvePrivateOwnerRoot({ ownerId }));
  await c.pool.query("INSERT INTO app_settings(namespace,setting_key,setting_value) VALUES('paths','music',$1::jsonb)", [JSON.stringify(original)]);
  await c.pool.query('UPDATE app_users SET is_disabled=TRUE WHERE id=$1', [ownerId]);
  await assert.rejects(root.resolvePrivateOwnerRoot({ ownerId }), { code: 'operator_track_scope_verification_required' });
  await c.pool.query('UPDATE app_users SET is_disabled=FALSE WHERE id=$1', [ownerId]);
  const reader = createLibraryWantedReleaseReader({ resolvePrivateTrackRoot: root.resolvePrivateOwnerRoot }); let reads = 0;
  const wantedBefore = (await c.pool.query('SELECT * FROM library_wanted_releases ORDER BY id')).rows;
  const wanted = createLibraryWantedReleaseService({ assertMaintenanceWriteAllowed: async () => {}, projectionReader: {
    readWantedReleaseProjection: async input => {
      const projection = await reader.readWantedReleaseProjection(input);
      // Same-transaction drift remains detectable. An external writer waits for publication.
      if (++reads === 1) await input.queryable.query("UPDATE app_settings SET setting_value='null'::jsonb WHERE namespace='paths' AND setting_key='music'");
      return projection;
    },
  } });
  await assert.rejects(wanted.reconcileWantedReleases(), { code: 'library_wanted_projection_stale' });
  assert.deepEqual((await c.pool.query('SELECT * FROM library_wanted_releases ORDER BY id')).rows, wantedBefore);
  await c.pool.query("UPDATE app_settings SET setting_value=$1::jsonb WHERE namespace='paths' AND setting_key='music'", [JSON.stringify(original)]);
}
