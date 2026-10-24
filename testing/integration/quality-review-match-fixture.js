/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */
import { seedImportCandidateFixture } from './import-candidate-fixtures.js';

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
