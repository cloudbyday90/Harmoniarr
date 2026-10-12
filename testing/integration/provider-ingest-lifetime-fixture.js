/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { createServer } from 'node:http';
import { getPool } from '../../src/server/database.js';
import { createLibraryMediaRequestStore } from '../../src/server/library/library-media-request-store.js';
import { createLibraryProviderIngestPlanningService } from '../../src/server/library/library-provider-ingest-planning-service.js';
import { createLibraryProviderIngestExecutionService } from '../../src/server/library/library-provider-ingest-execution-service.js';
import { createFixtureGate } from './fixture-lifecycle.js';

/** Seed real request/plan/queue owners; no live provider or full HTTP app is involved. */
export async function seedProviderIngestLifetimeRun({ sourceUrl, sourceProvider, collectionIntakeService = null }) {
  const users = (await getPool().query(`INSERT INTO app_users(username,password_hash,role)
    VALUES ('ingest-actor','synthetic-unused-password','admin'), ('ingest-recipient','synthetic-unused-password','requester')
    RETURNING id, username`)).rows;
  const actorId = users.find(user => user.username === 'ingest-actor').id;
  const recipientId = users.find(user => user.username === 'ingest-recipient').id;
  const request = await createLibraryMediaRequestStore().createMediaRequest({ requestKind: 'external_url', requestState: 'needs_fetch',
    requestedByUserId: actorId, requestedForUserId: recipientId, sourceProvider, sourceUrl, normalizedQuery: 'provider ingest lifetime' });
  const plan = await createLibraryProviderIngestPlanningService({ collectionIntakeService })
    .planExternalMediaRequest({ mediaRequestId: request.id, triggeredByUserId: actorId });
  const source = plan.normalizedSource;
  const queued = await createLibraryProviderIngestExecutionService().queueExternalMediaRequestExecution({ mediaRequestId: request.id,
    canonicalUrl: source.canonicalUrl, resourceType: source.resourceType, sourceIdentifier: source.sourceIdentifier,
    sourceProvider: source.provider, triggeredByUserId: actorId });
  return { actorId, recipientId, request, run: queued.run };
}

/** Only the injected transport redirects validated client requests to an owned loopback server. */
export async function createProviderIngestHttpFixture({ signal, payload }) {
  const responseGate = createFixtureGate({ signal }); const entered = createFixtureGate({ signal });
  const transportCalls = []; const requests = [];
  const server = createServer((request, response) => {
    requests.push(request.method); request.resume(); entered.release();
    void responseGate.promise.then(() => {
      response.writeHead(200, { 'content-type': 'application/json' }); response.end(JSON.stringify(payload));
    }, () => { response.destroy(); });
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const endpoint = `http://127.0.0.1:${server.address().port}/owned-provider`;
  const fetchFn = (url, options) => {
    transportCalls.push({ url, method: options.method, redirect: options.redirect, signal: options.signal });
    return fetch(endpoint, options);
  };
  return { entered: entered.promise, release: responseGate.release, transportCalls, requests, fetchFn,
    async close() { responseGate.release(); await new Promise((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); }); } };
}

export async function readProviderIngestLifetimeState({ runId, mediaRequestId }) {
  const operation = (await getPool().query('SELECT status, summary, triggered_by_user_id FROM operation_runs WHERE id = $1', [runId])).rows[0];
  const request = (await getPool().query('SELECT requested_by_user_id, requested_for_user_id, evidence FROM media_requests WHERE id = $1', [mediaRequestId])).rows[0];
  const rows = (await getPool().query('SELECT status, canonical_url, evidence FROM provider_ingest_requests WHERE media_request_id = $1', [mediaRequestId])).rows;
  return { operation, request, rows };
}
