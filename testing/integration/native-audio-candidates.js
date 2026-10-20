/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { createLibraryAddFixtureUser, seedOwnedLibraryAddFixture, libraryAddRuntimePath } from './library-add-media-fixtures.js';
import { persistSettings } from '../../src/server/settings.js';
import { replaceImportCandidateFiles } from '../../src/server/import-candidates/import-candidate-repository.js';
import { initializeImportExecutionRunItems } from '../../src/server/import-candidates/import-candidate-execution-repository.js';
import { createImportExecutionHandoffFixtureContext } from './import-execution-handoff-fixtures.js';
import { nativePeer } from '../slskd/fixture-data.js';
import { nativeAudioFiles } from '../slskd/native-audio-data.js';

export async function seedNativeAudioCandidates({ client, getPoolFn, workspaceDir }) {
  const pool = getPoolFn(); const context = createImportExecutionHandoffFixtureContext({ getPoolFn }); const fixtures = [];
  for (const file of nativeAudioFiles) {
    const owner = await createLibraryAddFixtureUser(client, pool, 'native-audio-' + file.kind);
    const fixture = await seedOwnedLibraryAddFixture({ pool, owner, workspaceDir, audio: false, status: 'selected' });
    const [folderPath, filename] = file.filename.split('\\');
    await pool.query('UPDATE import_candidates SET username=$2,folder_path=$3,total_size_bytes=$4 WHERE id=$1', [fixture.candidateId, nativePeer, folderPath, file.size]);
    await replaceImportCandidateFiles(fixture.candidateId, [{ filename, folderPath, extension: 'wav', sizeBytes: file.size,
      bitRateKbps: 1411, sampleRateHz: 44100, bitDepth: 16, lengthSeconds: 2, isLocked: false, sourceFileIndex: 0,
      rawPayload: { filename: file.filename, size: file.size, bitRate: 1411, sampleRate: 44100, length: 2, bitDepth: 16 } }], pool);
    await pool.query("UPDATE app_users SET managed_library_relative_root=$2 WHERE id=$1", [owner.id, 'native-audio-' + file.kind]);
    await pool.query("UPDATE import_candidates SET normalized_payload=jsonb_set(normalized_payload,'{requestOwnership}',jsonb_build_object('sourceRequestedForUserId',$2::text)) WHERE id=$1", [fixture.candidateId, owner.id]);
    const run = await context.runs.createOperationRun({ status: 'running', requestedCandidateCount: 1,
      summary: { executionMode: 'download_enqueue', selectedCandidateId: fixture.candidateId, triggerSource: 'missing_music_manual',
        sourceWantedReleaseId: fixture.wantedId, sourceSearchId: fixture.searchId } });
    await initializeImportExecutionRunItems(run.id, [{ importCandidateId: fixture.candidateId, itemStatus: 'ready', position: 1,
      statusMessage: 'Controlled native audio planning', planningSnapshot: { candidate: { id: fixture.candidateId, username: nativePeer } } }], pool);
    fixtures.push({ ...fixture, file, importCandidateId: fixture.candidateId, operationRunId: run.id,
      sourcePath: join(workspaceDir, 'downloads', folderPath, filename), owner });
  }
  assert.equal(fixtures[0].file.size, fixtures[1].file.size);
  const transcodeTemp = join(workspaceDir, 'transcode-temp');
  await mkdir(transcodeTemp);
  await persistSettings([{ namespace: 'paths', settingKey: 'transcodeTemp', value: libraryAddRuntimePath(transcodeTemp) }], null, pool);
  return { context, fixtures };
}
