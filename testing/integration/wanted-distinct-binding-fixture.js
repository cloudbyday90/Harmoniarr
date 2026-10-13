/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import { createLibraryAddMediaFixture } from './library-add-media-fixtures.js';
import { seedTrackDeliveryRecoveryFixture } from './operator-track-delivery-recovery-fixture.js';
import { seedWantedDistinctConsent } from './wanted-distinct-consent-fixture.js';
import { seedWantedDistinctDelivery } from './wanted-distinct-delivery-fixture.js';
import { assertWantedDistinctFixtureOptions, wantedDistinctReceiptsPerBinding } from './wanted-distinct-binding-policy.js';
import { disabledWantedSeedObserver } from './wanted-seed-observer.js';
import { validateWantedDistinctReceipts } from './wanted-distinct-receipt-fixture.js';
import { applyWantedDistinctFixture } from './wanted-distinct-apply-fixture.js';

export async function seedWantedDistinctBindingProfile(workspaceDir, { bindings, mediaProfile, durationSeconds, signal,
  seedObserver = disabledWantedSeedObserver, seedPreviewMode = 'worker' }) {
  assertWantedDistinctFixtureOptions({ bindings, mediaProfile, durationSeconds }); signal?.throwIfAborted();
  const first = await seedTrackDeliveryRecoveryFixture(workspaceDir, { mediaProfile, durationSeconds, seedObserver });
  signal?.throwIfAborted();
  const { planned, applied } = await applyWantedDistinctFixture(first, { seedObserver, seedPreviewMode });
  assert.equal(applied.item.itemStatus, 'applied'); signal?.throwIfAborted();
  const deliveries = [{ ...first, planned }]; const { pool, paths, inspection } = first;
  const owners = [first.user, first.other];
  const media = createLibraryAddMediaFixture({ getFixtureRoot: () => workspaceDir });
  for (let context = 2; context <= bindings / 2; context++) {
    const fixture = await seedObserver.measure('consent', context, () => seedWantedDistinctConsent({ pool, owners, context, durationSeconds, signal }));
    deliveries.push(await seedWantedDistinctDelivery({ pool, paths, inspection, media, fixture,
      context, mediaProfile, durationSeconds, signal, seedObserver, seedPreviewMode }));
  }
  signal?.throwIfAborted();
  await seedObserver.measure('receipt_history', null, () => pool.query(`INSERT INTO import_candidates(source_provider,source_search_id,source_response_key,username,folder_path,status,raw_payload,normalized_payload,discovered_at)
    SELECT 'slskd','owned-distinct-profile',source.id::text||'-'||i::text,'fixture','fixture','applied','{}'::jsonb,
      jsonb_build_object('operatorTrackFulfillment',source.normalized_payload->'operatorTrackFulfillment'),NOW()
    FROM import_candidates source CROSS JOIN generate_series(1,$2::integer) i WHERE source.id=ANY($1::uuid[])`,
  [deliveries.map(row => row.candidateId), wantedDistinctReceiptsPerBinding - 1]));
  const files = deliveries.flatMap(row => row.planned.files.map(file => file.libraryTarget.path));
  const { stats, scopes, receipts } = await seedObserver.measure('receipt_validate', null,
    () => validateWantedDistinctReceipts({ pool, files, bindings, signal }));
  return { pool, files, deliveries, fileSizes: stats.map(info => info.size),
    dimensions: Object.freeze({ bindings, requirements: scopes.length, owners: 2, contexts: bindings / 2,
      receiptsPerBinding: wantedDistinctReceiptsPerBinding, receipts: receipts.length }) };
}
