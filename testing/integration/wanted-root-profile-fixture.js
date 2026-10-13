/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { seedTrackDeliveryRecoveryFixture, runTrackDeliveryApply } from './operator-track-delivery-recovery-fixture.js';
import { createImportCandidateApplyOperationService } from '../../src/server/import-candidates/import-candidate-apply-operation-service.js';
import { createLibraryWantedReleaseReader } from '../../src/server/library/library-wanted-release-reader.js';
import { createOperatorTrackDeliveryPlanService } from '../../src/server/metadata/operator-track-delivery-plan-service.js';
import { createWantedVerificationObserver } from '../../src/server/library/library-wanted-verification-observer.js';
import { fingerprintOperatorTrackFile } from '../../src/server/metadata/operator-track-file-evidence-service.js';

export async function seedWantedRootProfile(workspaceDir, { receiptCandidates, mediaProfile, durationSeconds }) {
  if (![1, 8, 24].includes(receiptCandidates)) throw new TypeError('Unknown controlled receipt cardinality');
  const c = await seedTrackDeliveryRecoveryFixture(workspaceDir, { mediaProfile, durationSeconds });
  const preview = await c.preview.previewImportCandidateApply({ importCandidateId: c.candidateId });
  const applied = await runTrackDeliveryApply(c, createImportCandidateApplyOperationService({ mediaInspectionService: c.inspection }));
  assert.equal(applied.item.itemStatus, 'applied');
  if (receiptCandidates > 1) {
    await c.pool.query(`INSERT INTO import_candidates(source_provider,source_search_id,source_response_key,username,folder_path,status,raw_payload,normalized_payload,discovered_at)
      SELECT 'slskd','owned-root-profile',i::text,'fixture','fixture','applied','{}'::jsonb,
        jsonb_build_object('operatorTrackFulfillment',source.normalized_payload->'operatorTrackFulfillment'),NOW()
      FROM import_candidates source CROSS JOIN generate_series(1,$2::integer) i WHERE source.id=$1::uuid`, [c.candidateId, receiptCandidates - 1]);
  }
  assert.equal((await c.pool.query('SELECT count(*)::integer count FROM operator_track_receipts')).rows[0].count, receiptCandidates * 2);
  return { ...c, preview };
}

// Owns only this borrowed client's returned query work; no pool patch, SQL output
// or extra checkout. The reader remains serial on the same physical connection.
export async function profileWantedProjection(client, { useCombinedRootRead, signal = null }) {
  let queryCount = 0; let queryMs = 0; let active = false; let record;
  const queryable = { async query(...args) {
    signal?.throwIfAborted();
    assert.equal(active, false, 'Queries on the owning client must remain serial'); active = true;
    const start = performance.now(); queryCount++;
    try { const result = await client.query(...args); signal?.throwIfAborted(); return result; }
    finally { queryMs += performance.now() - start; active = false; }
  } };
  const reader = createLibraryWantedReleaseReader({
    resolvePrivateTrackRoot: createOperatorTrackDeliveryPlanService({ useCombinedRootRead }).resolvePrivateOwnerRoot,
    fingerprintTrackFile: async (...args) => {
      signal?.throwIfAborted(); const result = await fingerprintOperatorTrackFile(...args); signal?.throwIfAborted(); return result;
    } });
  const observer = createWantedVerificationObserver({ enabled: true, onRecord: value => { record = value; } });
  observer.increment('projectionReads');
  try {
    const projection = await observer.measure('initial_projection', () => reader.readWantedReleaseProjection({ queryable, verificationObserver: observer }));
    observer.finish('completed'); return { projection, queryCount, queryMs, diagnostics: record };
  } catch (error) { observer.finish('failed'); throw error; }
}
