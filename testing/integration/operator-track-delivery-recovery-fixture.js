/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getPool } from '../../src/server/database.js';
import { persistSettings } from '../../src/server/settings.js';
import { seedOperatorTrackUnionFixture } from './operator-track-union-fixture.js';
import { createLibraryDiscoveryQualityContextService } from '../../src/server/library/library-discovery-quality-context-service.js';
import { createLibraryAddMediaFixture, libraryAddRuntimePath } from './library-add-media-fixtures.js';
import { seedImportCandidateFixture } from './import-candidate-fixtures.js';
import { createImportCandidateService } from '../../src/server/import-candidates/import-candidate-service.js';
import { createImportCandidatePreviewService } from '../../src/server/import-candidates/import-candidate-preview-service.js';
import { createImportCandidateApplyPreviewService } from '../../src/server/import-candidates/import-candidate-apply-preview-service.js';
import { createMediaInspectionService } from '../../src/server/media/media-inspection-service.js';
import { createImportCandidateApplyRunStore } from '../../src/server/import-candidates/import-candidate-apply-run-store.js';
import { createImportCandidateApplyWorker } from '../../src/server/import-candidates/import-candidate-apply-worker.js';
import { listImportApplyRunItems, replaceImportApplyRunItems, updateImportApplyRunItem } from '../../src/server/import-candidates/import-candidate-apply-repository.js';
import { listImportOperations } from '../../src/server/import-candidates/import-candidate-operation-repository.js';

export async function seedTrackDeliveryRecoveryFixture(workspaceDir) {
  const pool = getPool(); const paths = Object.fromEntries(['downloads', 'staging', 'music'].map(key => [key, join(workspaceDir, key)]));
  await mkdir(join(paths.downloads, 'union'), { recursive: true }); await mkdir(paths.staging, { recursive: true }); await mkdir(paths.music, { recursive: true });
  await persistSettings(Object.entries(paths).map(([settingKey, value]) => ({ namespace: 'paths', settingKey, value: libraryAddRuntimePath(value) })), null, pool);
  const fixture = await seedOperatorTrackUnionFixture();
  const quality = await createLibraryDiscoveryQualityContextService().resolveSharedDiscoveryQualityContext({ metadataReleaseId: fixture.metadata.metadataReleaseId,
    evidence: { sourceMediaRequestId: fixture.primary.id, sourceRequestedForUserId: fixture.user.id },
    operatorLinks: fixture.wanted.map(wanted => ({ wantedReleaseId: wanted.id, appUserId: wanted.app_user_id,
      operatorTrackScope: wanted.evidence.operatorTrackScope, qualityPreferences: {} })) });
  const releaseMbid = (await pool.query('SELECT musicbrainz_release_id FROM metadata_releases WHERE id=$1', [fixture.metadata.metadataReleaseId])).rows[0].musicbrainz_release_id;
  const media = createLibraryAddMediaFixture({ getFixtureRoot: () => workspaceDir }); const unavailable = await media.verifyTooling();
  if (unavailable) throw new Error(unavailable);
  const files = [];
  for (const participant of quality.operatorTrackParticipants) {
    const track = participant.scope.tracks[0]; const filename = `0${track.trackPosition} ${track.title}.flac`;
    const source = join(paths.downloads, 'union', filename);
    await media.mediaCommand('ffmpeg', ['-v', 'error', '-nostdin', '-y', '-f', 'lavfi', '-i', 'sine=frequency=1000:sample_rate=44100',
      '-t', '2', '-ac', '2', '-c:a', 'flac', '-metadata', `title=${track.title}`, '-metadata', `track=${track.trackPosition}`, '-metadata', 'disc=1',
      '-metadata', `MUSICBRAINZ_TRACKID=${track.recordingMbid}`, '-metadata', `MUSICBRAINZ_ALBUMID=${releaseMbid}`, source], { readonly: false });
    files.push({ filename, extension: 'flac', sizeBytes: (await stat(source)).size, lengthSeconds: 2, isLocked: false });
  }
  const third = join(paths.downloads, 'union', '03 Unrequested third.flac'); await writeFile(third, 'Keep the unrequested sibling');
  files.push({ filename: '03 Unrequested third.flac', extension: 'flac', sizeBytes: (await stat(third)).size, lengthSeconds: 2, isLocked: false });
  const seeded = await seedImportCandidateFixture({ queryable: pool, candidateOverrides: { status: 'pending', folderPath: 'union',
    sourceSearchId: 'recovery-union-search', normalizedPayload: { musicQueue: quality,
      requestOwnership: { sourceMediaRequestId: fixture.primary.id, sourceRequestedForUserId: fixture.user.id } } }, files });
  const candidates = createImportCandidateService({ pool }); await candidates.selectImportCandidate({ importCandidateId: seeded.id, actorUserId: fixture.user.id });
  await candidates.markImportCandidateImportPending({ importCandidateId: seeded.id });
  const inspection = createMediaInspectionService({ mediaCommandService: { runCommand: ({ binary, args }) => media.mediaCommand(binary, args) } });
  const naming = createImportCandidatePreviewService({ getImportCandidate: candidates.getImportCandidate });
  const preview = createImportCandidateApplyPreviewService({ previewImportCandidate: naming.previewImportCandidate, mediaInspectionService: inspection });
  return { ...fixture, pool, paths, third, candidateId: seeded.id, candidates, inspection, preview };
}

export async function runTrackDeliveryApply(c, operationService, { markApplied = c.candidates.markImportCandidateApplied } = {}) {
  const runs = createImportCandidateApplyRunStore();
  const run = await runs.createOperationRun({ requestedCandidateCount: 1, importCandidateIds: [c.candidateId] });
  const worker = createImportCandidateApplyWorker({ ...runs,
    buildImportPendingCandidateSummary: async () => ({ counts: { ready: 1, totalImportPending: 1 }, importPendingCandidates: [{
      ...await c.candidates.getImportCandidate({ importCandidateId: c.candidateId }), importStatus: { code: 'ready', message: 'Current typed delivery' } }] }),
    previewImportCandidateApply: c.preview.previewImportCandidateApply,
    applyImportCandidatePreview: operationService.applyImportCandidatePreview,
    markImportCandidateApplied: markApplied,
    listImportApplyRunItems, replaceImportApplyRunItems, updateImportApplyRunItem, listImportOperations,
  });
  try {
    const { completion } = await worker.startWorkerRun({ runId: run.id, importCandidateIds: [c.candidateId], executableCandidateCount: 1, requestedCandidateCount: 1 });
    await completion;
  } finally { await worker.close(); }
  return { run, item: (await listImportApplyRunItems(run.id))[0] };
}
