/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { getPool } from '../../src/server/database.js';
import { createLibraryExternalRequestReviewService } from '../../src/server/library/library-external-request-review-service.js';
import { createLibraryMediaRequestStore } from '../../src/server/library/library-media-request-store.js';
import { createLibraryProviderIngestRequestStore } from '../../src/server/library/library-provider-ingest-request-store.js';
import { createSlskdClient } from '../../src/server/integrations/slskd/slskd-client.js';
import { createSlskdService } from '../../src/server/slskd/slskd-service.js';
import { createFixtureGate } from './fixture-lifecycle.js';
import { seedMetadataReleaseFixture } from './metadata-fixtures.js';

/** Real review owner creates approved intent, queued discovery and approval audit. */
export async function seedExternalDiscoveryLifetimeRun() {
  const users = (await getPool().query(`INSERT INTO app_users(username,password_hash,role)
    VALUES ('discovery-actor','synthetic-unused-password','admin'), ('discovery-recipient','synthetic-unused-password','requester')
    RETURNING id, username`)).rows;
  const actorId = users.find(user => user.username === 'discovery-actor').id;
  const recipientId = users.find(user => user.username === 'discovery-recipient').id;
  const request = await createLibraryMediaRequestStore().createMediaRequest({ requestKind: 'external_url', requestState: 'needs_fetch',
    requestedByUserId: actorId, requestedForUserId: recipientId, sourceProvider: 'spotify',
    sourceUrl: 'https://open.spotify.com/album/album123', normalizedQuery: 'external discovery lifetime' });
  const metadata = await seedMetadataReleaseFixture({ queryable: getPool() });
  const [item] = await createLibraryProviderIngestRequestStore().insertProviderIngestRequests({ providerIngestRequests: [{
    mediaRequestId: request.id, sourceProvider: 'spotify', sourceIdentifier: 'album123', sourceResourceType: 'release', ingestTargetType: 'release',
    canonicalUrl: request.sourceUrl, status: 'completed', evidence: { fetchedAt: '2026-10-12T00:00:00.000Z',
      response: { id: 'album123', name: 'Amber', artists: [{ name: 'Autechre' }], total_tracks: 1 } },
  }] });
  const approved = await createLibraryExternalRequestReviewService().approveRelease({ actorUserId: actorId, mediaRequestId: request.id,
    metadataReleaseId: metadata.metadataReleaseId, providerIngestRequestId: item.id });
  return { actorId, recipientId, request, metadata, intent: approved.intent, run: approved.run };
}

/** Native loopback HTTP exercises real slskd client/service; no Soulseek daemon is contacted. */
export async function createExternalDiscoveryHttpFixture({ signal }) {
  const responseGate = createFixtureGate({ signal }); const entered = createFixtureGate({ signal });
  let searchId = randomUUID(); let searchAvailable = true; const requests = []; const queries = [];
  const server = createServer((request, response) => {
    requests.push({ method: request.method, path: request.url });
    if (request.method === 'POST' && request.url === '/api/v0/searches') {
      let body = ''; request.on('data', chunk => { body += chunk; });
      request.on('end', () => {
        const input = JSON.parse(body); searchId = input.id ?? searchId; searchAvailable = true; queries.push(input.searchText);
        response.writeHead(200, { 'content-type': 'application/json' }); response.end(JSON.stringify({ id: searchId, searchText: input.searchText }));
      });
    } else if (request.method === 'GET' && request.url.startsWith(`/api/v0/searches/${searchId}?`)) {
      if (!searchAvailable) { request.resume(); response.writeHead(404); response.end(); return; }
      request.resume(); response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ id: searchId, searchText: queries.at(-1) }));
    } else if (request.method === 'GET' && request.url === `/api/v0/searches/${searchId}/responses`) {
      request.resume(); entered.release();
      void responseGate.promise.then(() => {
        response.writeHead(200, { 'content-type': 'application/json' }); response.end(JSON.stringify([{
          username: 'owned-peer', hasFreeUploadSlot: true, queueLength: 0, uploadSpeed: 2048,
          files: [{ filename: 'Autechre\\Amber\\01 Foil.flac', size: 42000000, length: 322, bitDepth: 16, sampleRate: 44100 }],
        }]));
      }, () => { response.destroy(); });
    } else { request.resume(); response.writeHead(404); response.end(); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const config = { baseUrl: `http://127.0.0.1:${server.address().port}`, allowedHosts: ['127.0.0.1'], apiKey: 'synthetic-owned-key' };
  const client = createSlskdClient(config);
  return { service: createSlskdService({ slskdClient: client, getClientConfig: async () => config }), get searchId() { return searchId; }, requests, queries,
    removeSearch: () => { searchAvailable = false; },
    entered: entered.promise, release: responseGate.release,
    async close() { responseGate.release(); await new Promise((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); }); } };
}

export async function readExternalDiscoveryLifetimeState({ runId }) {
  const operation = (await getPool().query('SELECT status, summary, triggered_by_user_id FROM operation_runs WHERE id = $1', [runId])).rows[0];
  const candidates = (await getPool().query('SELECT id, status, normalized_payload FROM import_candidates')).rows;
  const files = (await getPool().query('SELECT import_candidate_id FROM import_candidate_files')).rows;
  const audits = (await getPool().query("SELECT actor_user_id FROM audit_events WHERE event_type = 'import_candidates_slskd_ingested'")).rows;
  return { operation, candidates, files, audits };
}
