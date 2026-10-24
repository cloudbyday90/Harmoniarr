/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */
import { seedImportCandidateFixture } from './import-candidate-fixtures.js';

/** Narrow read/guard facts in one insert; selected alternatives still use real file fixtures. */
export async function seedQualityReviewScanRows(fixture, { weakCount = 200 } = {}) {
  await fixture.pool.query(`INSERT INTO import_candidates
    (id,source_provider,source_search_id,source_response_key,status,normalized_payload,file_count,total_size_bytes,
      username,folder_path,raw_payload,discovered_at)
    SELECT ('00000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
      source_provider,source_search_id,'scan-weak-' || n,'pending',
      normalized_payload || '{"extensions":["mp3"]}'::jsonb,1,50000000,username,folder_path,'{}'::jsonb,NOW()
    FROM import_candidates CROSS JOIN generate_series(1,$2::int) AS series(n) WHERE id=$1`, [fixture.candidateId, weakCount]);
}

/** Existing controlled search candidates; no provider discovery or measured-audio claim. */
export async function seedQualityReviewAlternative(fixture, { extension = 'flac', context = null, sourceSearchId = fixture.searchId } = {}) {
  const failed = await fixture.module.importCandidateService.getImportCandidate({ importCandidateId: fixture.candidateId });
  return seedImportCandidateFixture({ queryable: fixture.pool,
    candidateOverrides: { sourceSearchId, status: 'pending', normalizedPayload: {
      ...failed.normalizedPayload, extensions: [extension], musicQueue: context ?? failed.normalizedPayload.musicQueue,
    } },
    files: [{ filename: `01 Controlled.${extension}`, extension, sizeBytes: 50_000_000,
      bitRateKbps: extension === 'mp3' ? 128 : 900, sampleRateHz: 44_100, lengthSeconds: 2, isLocked: false }],
  });
}

/** Higher raw scores deliberately put the eligible choice beyond the old shortlist. */
export async function seedHiddenQualityReviewChoice(fixture, { weakCount = 51 } = {}) {
  const weakIds = [];
  for (let index = 0; index < weakCount; index++) weakIds.push((await seedQualityReviewAlternative(fixture, { extension: 'mp3' })).id);
  await fixture.pool.query(`UPDATE import_candidates SET normalized_payload=normalized_payload || '{"compositeScore":100}'
    WHERE id=ANY($1::uuid[])`, [weakIds]);
  const eligible = await seedQualityReviewAlternative(fixture);
  await fixture.pool.query(`UPDATE import_candidates SET normalized_payload=normalized_payload || '{"compositeScore":0}' WHERE id=$1`, [eligible.id]);
  return { weakIds, eligible };
}
