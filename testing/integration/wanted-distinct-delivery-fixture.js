/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createLibraryDiscoveryQualityContextService } from '../../src/server/library/library-discovery-quality-context-service.js';
import { createImportCandidateService } from '../../src/server/import-candidates/import-candidate-service.js';
import { createImportCandidatePreviewService } from '../../src/server/import-candidates/import-candidate-preview-service.js';
import { createImportCandidateApplyPreviewService } from '../../src/server/import-candidates/import-candidate-apply-preview-service.js';
import { seedImportCandidateFixture } from './import-candidate-fixtures.js';
import { applyWantedDistinctFixture } from './wanted-distinct-apply-fixture.js';
import { disabledWantedSeedObserver } from './wanted-seed-observer.js';
import { observeWantedSeedMedia } from './wanted-seed-media-observer.js';

export async function seedWantedDistinctDelivery({ pool, paths, media, inspection, fixture,
  context, mediaProfile, durationSeconds, signal, seedObserver = disabledWantedSeedObserver, seedPreviewMode = 'worker' }) {
  media = observeWantedSeedMedia(media, { observer: seedObserver, context });
  signal?.throwIfAborted();
  const folder = `distinct-binding-${context}`; const directory = join(paths.downloads, folder);
  await mkdir(directory, { recursive: true });
  const quality = await createLibraryDiscoveryQualityContextService().resolveSharedDiscoveryQualityContext({
    metadataReleaseId: fixture.metadata.metadataReleaseId,
    evidence: { sourceMediaRequestId: fixture.primary.id, sourceRequestedForUserId: fixture.user.id },
    operatorLinks: fixture.wanted.map(wanted => ({ wantedReleaseId: wanted.id, appUserId: wanted.app_user_id,
      operatorTrackScope: wanted.evidence.operatorTrackScope, qualityPreferences: {} })) });
  const releaseMbid = (await pool.query('SELECT musicbrainz_release_id FROM metadata_releases WHERE id=$1',
    [fixture.metadata.metadataReleaseId])).rows[0].musicbrainz_release_id;
  const files = [];
  for (const participant of quality.operatorTrackParticipants) {
    signal?.throwIfAborted();
    const track = participant.scope.tracks[0]; const filename = `0${track.trackPosition} ${track.title}.flac`;
    const source = join(directory, filename);
    const audio = mediaProfile === 'noise' ? 'anoisesrc=color=white:seed=42:sample_rate=192000' : 'sine=frequency=1000:sample_rate=44100';
    const encoding = mediaProfile === 'noise' ? ['-sample_fmt', 's32', '-compression_level', '0'] : [];
    await media.mediaCommand('ffmpeg', ['-v', 'error', '-nostdin', '-y', '-f', 'lavfi', '-i', audio,
      '-t', String(durationSeconds), '-ac', '2', '-c:a', 'flac', ...encoding, '-metadata', `title=${track.title}`,
      '-metadata', `track=${track.trackPosition}`, '-metadata', 'disc=1', '-metadata', `MUSICBRAINZ_TRACKID=${track.recordingMbid}`,
      '-metadata', `MUSICBRAINZ_ALBUMID=${releaseMbid}`, source], { readonly: false });
    signal?.throwIfAborted();
    files.push({ filename, extension: 'flac', sizeBytes: (await stat(source)).size,
      lengthSeconds: durationSeconds, isLocked: false });
  }
  const third = join(directory, '03 Unrequested third.flac'); await writeFile(third, 'Keep the unrequested sibling');
  files.push({ filename: '03 Unrequested third.flac', extension: 'flac', sizeBytes: (await stat(third)).size,
    lengthSeconds: 2, isLocked: false });
  const prepared = await seedObserver.measure('candidate_prepare', context, async () => {
  const candidate = await seedImportCandidateFixture({ queryable: pool, candidateOverrides: { status: 'pending',
    folderPath: folder, sourceSearchId: folder, normalizedPayload: { musicQueue: quality,
      requestOwnership: { sourceMediaRequestId: fixture.primary.id, sourceRequestedForUserId: fixture.user.id } } }, files });
  const candidates = createImportCandidateService({ pool });
  await candidates.selectImportCandidate({ importCandidateId: candidate.id, actorUserId: fixture.user.id });
  await candidates.markImportCandidateImportPending({ importCandidateId: candidate.id });
  const naming = createImportCandidatePreviewService({ getImportCandidate: candidates.getImportCandidate });
  const preview = createImportCandidateApplyPreviewService({ previewImportCandidate: naming.previewImportCandidate, mediaInspectionService: inspection });
  return { candidateId: candidate.id, candidates, preview };
  });
  const input = { ...fixture, pool, paths, third, ...prepared, inspection };
  const { planned, applied } = await applyWantedDistinctFixture(input, { context, seedObserver, seedPreviewMode });
  assert.equal(applied.item.itemStatus, 'applied'); signal?.throwIfAborted();
  return { ...input, planned };
}
