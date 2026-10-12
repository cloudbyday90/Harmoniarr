/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { getPool } from '../../src/server/database.js';
import { createMusicBrainzClient } from '../../src/server/integrations/musicbrainz/musicbrainz-client.js';
import { normalizeMusicBrainzArtist } from '../../src/server/integrations/musicbrainz/musicbrainz-normalizer.js';
import { createMetadataService } from '../../src/server/metadata/metadata-service.js';
import { createMetadataArtistRefreshRunStore } from '../../src/server/metadata/metadata-artist-refresh-run-store.js';
import { createMetadataRefreshSchedulerService } from '../../src/server/metadata/metadata-refresh-scheduler-service.js';
import { createOperatorArtistMonitoringStore } from '../../src/server/metadata/operator-artist-monitoring-store.js';
import { defaultOperatorArtistMonitoringPolicy } from '../../src/server/metadata/operator-artist-monitoring-policy.js';
import { createFixtureGate } from './fixture-lifecycle.js';

export const metadataRefreshFixtureTime = '2026-10-12T12:00:00.000Z';
export async function seedMetadataRefreshLifetimeRun({ artistMbid }) {
  const artist = await createMetadataService().storeArtist(normalizeMusicBrainzArtist({
    artist: { id: artistMbid, name: 'Original owned artist', 'sort-name': 'Original owned artist', aliases: [] }, fetchedAt: '2026-10-11T00:00:00.000Z',
  }));
  const user = (await getPool().query("INSERT INTO app_users(username,password_hash,role) VALUES ('refresh-owner','synthetic-unused-password','admin') RETURNING id")).rows[0];
  await createOperatorArtistMonitoringStore().upsertOperatorArtistMonitoring({ ...defaultOperatorArtistMonitoringPolicy,
    appUserId: user.id, metadataArtistId: artist.id, isMonitored: true, monitoredReleaseGroupTypes: ['album'] });
  await createMetadataRefreshSchedulerService().ensureArtistRefreshScheduled({ metadataArtistId: artist.id, now: '2026-10-11T00:00:00.000Z' });
  const run = await createMetadataArtistRefreshRunStore().createOperationRun({ artistName: artist.name,
    metadataArtistId: artist.id, musicBrainzArtistId: artistMbid, triggeredByUserId: user.id });
  return { artist, user, run };
}

/** Production client validates its official HTTPS destination; only injected transport maps to owned HTTP. */
export async function createMetadataRefreshHttpFixture({ signal }) {
  const artistMbid = randomUUID(); const groupMbid = randomUUID(); const responseGate = createFixtureGate({ signal });
  const entered = createFixtureGate({ signal }); const requests = []; const transportCalls = [];
  const server = createServer((request, response) => {
    const path = new URL(request.url, 'http://127.0.0.1').pathname;
    requests.push({ method: request.method, path }); request.resume();
    const send = payload => { response.writeHead(200, { 'content-type': 'application/json' }); response.end(JSON.stringify(payload)); };
    if (path === `/ws/2/artist/${artistMbid}`) {
      entered.release(); void responseGate.promise.then(() => send({ id: artistMbid, name: 'Updated owned artist', 'sort-name': 'Updated owned artist', aliases: [] }), () => { response.destroy(); });
    } else if (path === '/ws/2/release-group') send({ 'release-group-count': 1, 'release-groups': [{ id: groupMbid,
      title: 'Owned release group', 'primary-type': 'Album', 'first-release-date': '2026-10-01',
      'artist-credit': [{ artist: { id: artistMbid, name: 'Updated owned artist' }, name: 'Updated owned artist' }],
    }] });
    else { response.writeHead(404); response.end(); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const endpoint = `http://127.0.0.1:${server.address().port}`;
  const client = createMusicBrainzClient({ baseUrl: 'https://musicbrainz.org/ws/2', allowedHosts: ['musicbrainz.org'], allowedHostSuffixes: [], fetchImpl: (url, options) => {
    transportCalls.push({ url: url.toString(), method: options.method, redirect: options.redirect, userAgent: options.headers['User-Agent'] });
    const source = new URL(url); return fetch(`${endpoint}${source.pathname}${source.search}`, options);
  } });
  return { artistMbid, client, requests, transportCalls, entered: entered.promise, release: responseGate.release,
    async close() { responseGate.release(); await new Promise((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); }); } };
}

export async function readMetadataRefreshLifetimeState({ runId, artistId }) {
  const operation = (await getPool().query('SELECT status, summary FROM operation_runs WHERE id=$1', [runId])).rows[0];
  const artist = (await getPool().query('SELECT id, name FROM metadata_artists WHERE id=$1', [artistId])).rows[0];
  const groups = (await getPool().query('SELECT id FROM metadata_release_groups WHERE metadata_artist_id=$1', [artistId])).rows;
  const schedule = (await getPool().query('SELECT last_refreshed_at, next_refresh_at FROM metadata_artist_refresh_state WHERE metadata_artist_id=$1', [artistId])).rows[0];
  return { operation, artist, groups, schedule };
}
