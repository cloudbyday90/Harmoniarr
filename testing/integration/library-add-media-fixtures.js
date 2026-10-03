/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, stat } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { createOperationQueueStore } from '../../src/server/operation-queue-store.js';
import { persistSettings } from '../../src/server/settings.js';
import { seedImportCandidateFixture } from './import-candidate-fixtures.js';
import { seedMetadataReleaseFixture } from './metadata-fixtures.js';

const executeFile = promisify(execFile);
export const libraryAddRuntimePath = (value) => process.platform === 'win32' ? value.replace(/^[a-z]:/iu, '').replaceAll('\\', '/') : value;

/** Every media invocation is scoped to the scenario's own directory and has no provider/network access. */
export function createLibraryAddMediaFixture({ getFixtureRoot, isToolingReady = () => true,
  mediaImage = process.env.HARMONIARR_INTEGRATION_MEDIA_IMAGE } = {}) {
  function mountedPath(pathValue) {
    const scoped = relative(resolve(getFixtureRoot()), resolve(pathValue));
    assert.ok(scoped && scoped !== '..' && !scoped.startsWith(`..${sep}`) && !isAbsolute(scoped), 'media fixture must stay in the test-owned workspace');
    return `/fixtures/${scoped.split(sep).join('/')}`;
  }
  async function mediaCommand(binary, args, { readonly = true } = {}) {
    if (!mediaImage) return executeFile(binary, args, { timeout: 20_000, maxBuffer: 2 * 1024 * 1024 });
    const mappedArgs = args.map((value) => typeof value === 'string' && isAbsolute(value) ? mountedPath(value) : value);
    return executeFile('docker', ['run', '--rm', '--network', 'none', '--entrypoint', binary, '--mount',
      `type=bind,source=${resolve(getFixtureRoot())},target=/fixtures${readonly ? ',readonly' : ''}`, mediaImage, ...mappedArgs],
    { timeout: 30_000, maxBuffer: 2 * 1024 * 1024 });
  }
  async function generateAudio(pathValue, bitrate = null) {
    await mkdir(dirname(pathValue), { recursive: true });
    await mediaCommand('ffmpeg', ['-v', 'error', '-nostdin', '-y', '-f', 'lavfi', '-i', 'sine=frequency=1000:sample_rate=44100',
      '-t', '2', '-ac', '2', '-metadata', 'artist=Controlled fixture', '-metadata', 'album=Controlled release',
      '-metadata', 'title=Controlled song', '-metadata', 'track=1', ...(bitrate ? ['-c:a', 'libmp3lame', '-b:a', `${bitrate}k`] : ['-c:a', 'pcm_s16le']), pathValue], { readonly: false });
  }
  async function verifyTooling() {
    try {
      if (mediaImage) {
        const identity = await executeFile('docker', ['image', 'inspect', mediaImage, '--format', '{{.Id}}']);
        const version = await executeFile('docker', ['run', '--rm', '--network', 'none', '--entrypoint', 'ffprobe', mediaImage, '-version']);
        console.log(`Local media fixture: ${mediaImage} ${identity.stdout.trim()}; ${version.stdout.split('\n')[0]}`);
      } else {
        await executeFile('ffprobe', ['-version']); await executeFile('ffmpeg', ['-version']);
      }
      return null;
    } catch { return 'Local ffmpeg/ffprobe fixture unavailable; configure HARMONIARR_INTEGRATION_MEDIA_IMAGE or install local tools'; }
  }
  const getTooling = async () => ({ status: isToolingReady() ? 'healthy' : 'degraded',
    details: { ffprobeAvailable: isToolingReady(), ffmpegAvailable: isToolingReady() } });
  return { generateAudio, getTooling, mediaCommand, verifyTooling };
}

export async function createLibraryAddFixtureUser(client, pool, username, preferences = { minimumQuality: 'high', preferredFormat: 'any' }) {
  const response = await client.requestJson('/api/v1/users', { method: 'POST', json: { username, password: 'InitialPass123!', role: 'requester' } });
  assert.equal(response.response.status, 201);
  await pool.query('UPDATE app_users SET must_change_password = false, user_preferences = $2::jsonb WHERE id = $1', [response.payload.user.id, JSON.stringify(preferences)]);
  return response.payload.user;
}

export async function seedOwnedLibraryAddFixture({ pool, owner, workspaceDir, mediaFixture, audio = true, extension = 'wav', bitrate = null,
  status = 'import_pending', stoppedReasonCode = null, repairPaths = true, profileCode = 'high_quality', minimumBitrateKbps = 320 } = {}) {
  const metadata = await seedMetadataReleaseFixture({ queryable: pool, artistName: `Controlled ${owner.id}`, trackTitle: 'Controlled song', trackLengthMs: 2000 });
  const wanted = (await pool.query(`INSERT INTO library_wanted_releases
    (app_user_id,metadata_artist_id,metadata_release_group_id,metadata_release_id,wanted_status,expected_track_count,matched_track_count,missing_track_count)
    VALUES ($1,$2,$3,$4,'missing',1,0,1) RETURNING id`, [owner.id, metadata.metadataArtistId, metadata.metadataReleaseGroupId, metadata.metadataReleaseId])).rows[0];
  const searchId = `controlled-library-add-${wanted.id}`;
  const discovery = (await pool.query(`INSERT INTO library_discovery_requests
    (metadata_artist_id,metadata_release_group_id,metadata_release_id,wanted_status,search_mode,request_status,evidence)
    SELECT metadata_artist_id,metadata_release_group_id,metadata_release_id,'missing','automatic','blocked',jsonb_build_object('lastSearchId',$2::text)
    FROM library_wanted_releases WHERE id=$1 RETURNING id`, [wanted.id, searchId])).rows[0];
  await pool.query('INSERT INTO library_discovery_request_wanted_release_links (discovery_request_id,wanted_release_id) VALUES ($1,$2)', [discovery.id, wanted.id]);
  const folderPath = `Controlled-${wanted.id}`;
  const sourcePath = join(workspaceDir, 'downloads', folderPath, `01 Controlled.${extension}`);
  if (audio) await mediaFixture.generateAudio(sourcePath, bitrate);
  const candidate = await seedImportCandidateFixture({ queryable: pool, candidateOverrides: { status, sourceSearchId: searchId, folderPath,
    normalizedPayload: { musicQueue: { profileCode, ...(minimumBitrateKbps ? { minimumBitrateKbps } : {}), wantedReleaseId: wanted.id } } },
  files: [{ filename: `01 Controlled.${extension}`, extension, sizeBytes: audio ? (await stat(sourcePath)).size : 1,
    bitRateKbps: 320, sampleRateHz: 44_100, bitDepth: extension === 'wav' ? 16 : null, lengthSeconds: 2, isLocked: false }] });
  if (stoppedReasonCode) await pool.query(`INSERT INTO import_candidate_events (import_candidate_id,event_type,details,occurred_at)
    VALUES ($1,'import_candidate_import_blocked',$2::jsonb,NOW())`, [candidate.id,
  JSON.stringify({ addBlockerCode: stoppedReasonCode === 'audio_check_failed' ? 'media_verification' : 'source_path_unavailable', recoveryReasonCode: stoppedReasonCode })]);
  const paths = { downloads: join(workspaceDir, repairPaths ? 'downloads' : 'wrong-downloads'), staging: join(workspaceDir, 'staging'), music: join(workspaceDir, 'music') };
  await Promise.all(Object.values(paths).map((pathValue) => mkdir(pathValue, { recursive: true })));
  await persistSettings(Object.entries(paths).map(([settingKey, value]) => ({ namespace: 'paths', settingKey, value: libraryAddRuntimePath(value) })), null, pool);
  await persistSettings([{ namespace: 'paths', settingKey: 'downloadMappings', value: [{ slskdPrefix: '/controlled-downloads', harmoniarrPrefix: libraryAddRuntimePath(paths.downloads) }] }], null, pool);
  return { wantedId: wanted.id, candidateId: candidate.id, discoveryId: discovery.id, sourcePath, searchId, paths };
}

export async function runLibraryAddFixtureWorker({ pool, module, runId }) {
  const claimed = await createOperationQueueStore({ getPoolFn: () => pool }).claimNextRunnableRun({ operationTypes: ['import_candidate_apply'] });
  assert.equal(claimed.id, runId);
  module.importCandidateApplyWorker.startWorkerRun({ ...claimed.summary, runId });
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const run = await module.importCandidateApplyRunStore.getRunById(runId);
    if (['completed', 'failed', 'paused', 'cancelled'].includes(run.status)) return run;
    await new Promise((complete) => { setTimeout(complete, 100); });
  }
  assert.fail('The real apply worker did not persist a terminal result');
}
