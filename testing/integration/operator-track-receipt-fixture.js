/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { randomUUID } from 'node:crypto';
import { seedImportCandidateFixture } from './import-candidate-fixtures.js';

export function buildTrackReceipt({ ownerId = randomUUID(), metadataReleaseId = randomUUID() } = {}) {
  const track = { metadataTrackId: randomUUID(), metadataReleaseId, recordingMbid: randomUUID(),
    mediumPosition: 1, trackPosition: 1, title: 'Fixture track', lengthMs: 2000 };
  return { version: 1, ownerId, sourceMediaRequestId: randomUUID(),
    scope: { version: 1, mode: 'tracks', metadataReleaseId, tracks: [track] },
    files: [{ fileId: randomUUID(), libraryPath: '/fixture/private/track.flac', track,
      evidence: { sizeBytes: 42, sha256: 'a'.repeat(64) } }] };
}

export async function seedTrackReceiptCandidate(pool, receipt, status = 'applied') {
  return seedImportCandidateFixture({ queryable: pool, files: [],
    candidateOverrides: { status, normalizedPayload: { operatorTrackFulfillment: receipt } } });
}

// Captured from e579c47's actual acquisition store for matched SQL-only comparison.
export const legacyTrackReceiptQuery = `SELECT candidate.id AS import_candidate_id,receipt FROM import_candidates candidate
  CROSS JOIN LATERAL jsonb_array_elements(CASE
    WHEN candidate.normalized_payload #>> '{operatorTrackFulfillment,version}'='2'
      AND jsonb_typeof(candidate.normalized_payload #> '{operatorTrackFulfillment,receipts}')='array'
      THEN CASE WHEN jsonb_array_length(candidate.normalized_payload #> '{operatorTrackFulfillment,receipts}')=2
        THEN candidate.normalized_payload #> '{operatorTrackFulfillment,receipts}' ELSE '[]'::jsonb END
    ELSE jsonb_build_array(candidate.normalized_payload->'operatorTrackFulfillment') END) AS receipts(receipt)
  WHERE candidate.status='applied' AND receipt->>'ownerId'=$1
    AND receipt #>> '{scope,metadataReleaseId}'=ANY($2::text[]) ORDER BY candidate.id,receipt->>'ownerId'`;

export async function seedReceiptLookupHistory(pool) {
  const receipt = buildTrackReceipt();
  await seedTrackReceiptCandidate(pool, receipt);
  const unrelated = buildTrackReceipt({ metadataReleaseId: receipt.scope.metadataReleaseId });
  await pool.query(`INSERT INTO import_candidates(source_provider,source_search_id,source_response_key,username,folder_path,status,raw_payload,normalized_payload,discovered_at)
    SELECT 'slskd','ledger-measurement',i::text,'fixture','fixture','applied','{}'::jsonb,
    jsonb_build_object('operatorTrackFulfillment',$1::jsonb,'unrelated',repeat('x',1024)),NOW()
    FROM generate_series(1,10000) i`, [JSON.stringify(unrelated)]);
  await pool.query('ANALYZE import_candidates');
  await pool.query('ANALYZE operator_track_receipts');
  return receipt;
}
