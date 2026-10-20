/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import express from 'express';
import { withServer } from '../server/http-test-helpers.js';
import { createSlskdService } from '../../src/server/slskd/slskd-service.js';
import { nativePeer } from './fixture-data.js';

// This owner supplies HTTP responses, never native search or database candidates.
export async function withAudioSearchResponses({ fixtures, runScenario }) {
  const apiKey = randomUUID();
  const searches = new Map();
  const calls = [];
  const app = express();
  app.use(express.json({ limit: '4kb' }));
  app.use((request, response, next) => {
    if (request.headers['x-api-key'] !== apiKey) return response.sendStatus(401);
    calls.push({ method: request.method, path: request.path });
    next();
  });
  function files(fixture) {
    return [{ filename: fixture.file.filename, size: fixture.file.size, extension: 'wav',
      bitRate: 1411, sampleRate: 44100, bitDepth: 16, length: 2, isLocked: false }];
  }
  function responses(fixture) {
    return [nativePeer, 'controlled-review-peer'].map(username => ({ username, hasFreeUploadSlot: true,
      queueLength: 0, uploadSpeed: 1_000_000, fileCount: 1, lockedFileCount: 0, files: files(fixture), lockedFiles: [] }));
  }
  app.post('/api/v0/searches', (request, response) => {
    const fixture = fixtures.find(row => request.body.searchText?.includes(row.folderPath));
    if (!fixture || fixture.searchId) return response.sendStatus(409);
    fixture.searchId = randomUUID();
    searches.set(fixture.searchId, fixture);
    response.status(201).json({ id: fixture.searchId, searchText: request.body.searchText, state: 'Completed', isComplete: true, responseCount: 2 });
  });
  app.get('/api/v0/searches/:id/responses', (request, response) => {
    const fixture = searches.get(request.params.id);
    if (!fixture) return response.sendStatus(404);
    response.json(responses(fixture));
  });
  app.get('/api/v0/searches/:id', (request, response) => {
    const fixture = searches.get(request.params.id);
    if (!fixture) return response.sendStatus(404);
    response.json({ id: fixture.searchId, state: 'Completed', isComplete: true, responseCount: 2,
      ...(request.query.includeResponses === 'true' ? { responses: responses(fixture) } : {}) });
  });
  app.post('/api/v0/users/:username/directory', (request, response) => {
    const fixture = fixtures.find(row => row.folderPath === request.body.directory);
    if (!fixture || ![nativePeer, 'controlled-review-peer'].includes(request.params.username)) return response.sendStatus(404);
    response.json({ name: fixture.folderPath, files: files(fixture).map(file => ({ ...file, filename: file.filename.split('\\').at(-1) })) });
  });
  return withServer(app, async baseUrl => {
    const service = createSlskdService({ getClientConfig: async () => ({ enabled: true, baseUrl, apiKey }) });
    const result = await runScenario(service, () => assert.equal(calls.length, 0, 'Refusals must precede all provider traffic'));
    assert.equal(searches.size, fixtures.length);
    assert.equal(calls.filter(call => call.method === 'POST' && call.path === '/api/v0/searches').length, fixtures.length);
    for (const fixture of fixtures) assert.ok(calls.some(call => call.path === '/api/v0/searches/' + fixture.searchId + '/responses'));
    return { ...result, searchTransport: { boundary: 'owned-http-responses-real-client', searches: searches.size, calls } };
  });
}
