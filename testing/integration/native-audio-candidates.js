/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { createLibraryAddFixtureUser, libraryAddRuntimePath } from './library-add-media-fixtures.js';
import { seedMetadataReleaseFixture } from './metadata-fixtures.js';
import { persistSettings } from '../../src/server/settings.js';
import { nativeAudioFiles } from '../slskd/native-audio-data.js';

export async function prepareNativeAudioDiscovery({ client, pool, workspaceDir, library }) {
  const fixtures = [];
  const paths = Object.fromEntries(['downloads', 'staging', 'music'].map(key => [key, join(workspaceDir, key)]));
  const transcodeTemp = join(workspaceDir, 'transcode-temp');
  await Promise.all([...Object.values(paths), transcodeTemp].map(value => mkdir(value, { recursive: true })));
  await persistSettings([...Object.entries(paths), ['transcodeTemp', transcodeTemp]].map(([settingKey, value]) =>
    ({ namespace: 'paths', settingKey, value: libraryAddRuntimePath(value) })), null, pool);
  await persistSettings([{ namespace: 'paths', settingKey: 'downloadMappings', value:
    [{ slskdPrefix: '/controlled-downloads', harmoniarrPrefix: libraryAddRuntimePath(paths.downloads) }] }], null, pool);
  for (const file of nativeAudioFiles) {
    const owner = await createLibraryAddFixtureUser(client, pool, 'native-audio-' + file.kind);
    const [folderPath, filename] = file.filename.split('\\');
    const metadata = await seedMetadataReleaseFixture({ queryable: pool, artistName: 'Controlled ' + file.kind,
      releaseTitle: folderPath, trackTitle: 'Controlled', trackLengthMs: 2000 });
    // This synthetic artist has no public identity; artwork prefetch must stay local.
    await pool.query('UPDATE metadata_artists SET musicbrainz_artist_id=NULL WHERE id=$1', [metadata.metadataArtistId]);
    await pool.query(`INSERT INTO operator_artist_monitoring
      (app_user_id,metadata_artist_id,is_monitored,release_scope,wanted_automation_mode)
      VALUES ($1,$2,true,'current_and_future','current_and_future_matching')`, [owner.id, metadata.metadataArtistId]);
    await pool.query('UPDATE app_users SET managed_library_relative_root=$2 WHERE id=$1', [owner.id, 'native-audio-' + file.kind]);
    fixtures.push({ owner, file, metadata, folderPath, paths, sourcePath: join(paths.downloads, folderPath, filename) });
  }
  await library.libraryWantedReleaseService.reconcileWantedReleases();
  await library.libraryDiscoveryRequestService.reconcileDiscoveryRequests();
  for (const fixture of fixtures) {
    const rows = (await pool.query(`SELECT w.id, l.discovery_request_id FROM library_wanted_releases w
      JOIN library_discovery_request_wanted_release_links l ON l.wanted_release_id=w.id
      WHERE w.app_user_id=$1 AND w.metadata_release_id=$2`, [fixture.owner.id, fixture.metadata.metadataReleaseId])).rows;
    assert.equal(rows.length, 1);
    fixture.wantedId = rows[0].id;
    fixture.discoveryId = rows[0].discovery_request_id;
  }
  assert.equal((await pool.query('SELECT count(*)::int count FROM import_candidates')).rows[0].count, 0);
  return fixtures;
}
