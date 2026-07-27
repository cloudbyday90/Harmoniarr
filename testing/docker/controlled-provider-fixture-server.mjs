/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { copyFile, mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { basename, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

import {
  buildControlledProviderFixtureFilename,
  buildControlledProviderRemoteFilename,
  findControlledProviderFixtureBySearchText,
} from './controlled-provider-fixture-catalog.mjs';

const apiKey = process.env.CONTROLLED_PROVIDER_API_KEY ?? '';
const downloadsRoot = process.env.CONTROLLED_PROVIDER_DOWNLOADS_ROOT ?? '/data/downloads';
const port = Number.parseInt(process.env.PORT ?? '5030', 10);
const searches = new Map();
const transfersByUsername = new Map();

function writeJson(response, statusCode, payload) {
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const value = Buffer.concat(chunks).toString('utf8');
  return value ? JSON.parse(value) : null;
}

function isAuthorized(request) {
  return !apiKey || request.headers['x-api-key'] === apiKey;
}

function buildProviderFile(fixture, { variant = 'primary' } = {}) {
  return {
    bitDepth: ['flac', 'alac', 'wav'].includes(fixture.format) ? 24 : null,
    bitRate: ['mp3', 'aac', 'opus', 'ogg'].includes(fixture.format) ? 320 : 1000,
    extension: fixture.format,
    filename: buildControlledProviderRemoteFilename(fixture, { variant }),
    isLocked: false,
    length: 3,
    sampleRate: 44100,
    size: 65536,
  };
}

function buildResponse(fixture) {
  if (!fixture || fixture.scenario === 'no_response') return [];
  const file = buildProviderFile(fixture);
  const lockedFiles = fixture.scenario === 'locked_extra_file'
    ? [{ ...file, filename: `${file.filename}.locked`, isLocked: true }]
    : [];
  const primaryResponse = {
    fileCount: 1,
    files: [file],
    hasFreeUploadSlot: true,
    lockedFileCount: lockedFiles.length,
    lockedFiles,
    queueLength: 0,
    uploadSpeed: fixture.scenario === 'recovery_fallback' ? 2_000_000 : 1_000_000,
    username: `controlled-${fixture.id}`,
  };
  if (fixture.scenario !== 'recovery_fallback') return [primaryResponse];

  return [primaryResponse, {
    ...primaryResponse,
    files: [buildProviderFile(fixture, { variant: 'fallback' })],
    uploadSpeed: 500_000,
    username: `controlled-${fixture.id}-fallback`,
  }];
}

function buildSearchState(search, { includeResponses = false } = {}) {
  const responses = buildResponse(search.fixture);
  const visible = search.pollCount > 0 ? responses : [];
  return {
    endedAt: search.pollCount > 0 ? new Date().toISOString() : null,
    fileCount: visible.reduce((total, response) => total + response.files.length, 0),
    id: search.id,
    isComplete: search.pollCount > 0,
    lockedFileCount: visible.reduce((total, response) => total + response.lockedFiles.length, 0),
    responseCount: visible.length,
    responses: includeResponses ? visible : [],
    searchText: search.searchText,
    startedAt: search.startedAt,
    state: search.pollCount > 0 ? 'Completed' : 'Searching',
  };
}

function listTransfers(username) {
  return [{
    directories: [{
      directory: '\\data\\downloads\\complete',
      fileCount: (transfersByUsername.get(username) ?? []).length,
      files: transfersByUsername.get(username) ?? [],
    }],
    username,
  }];
}

async function enqueueTransfers(username, files) {
  const accepted = [];
  for (const file of files) {
    const remoteFilename = typeof file?.filename === 'string' ? file.filename : '';
    const fixture = [...searches.values()].map((search) => search.fixture).find((entry) => (
      entry && [
        buildControlledProviderRemoteFilename(entry),
        buildControlledProviderRemoteFilename(entry, { variant: 'fallback' }),
      ].includes(remoteFilename)
    ));
    if (!fixture) continue;
    const variant = remoteFilename === buildControlledProviderRemoteFilename(fixture, { variant: 'fallback' })
      ? 'fallback'
      : 'primary';
    const transferFailed = fixture.scenario === 'recovery_fallback' && variant === 'primary';
    const destinationDirectory = resolve(downloadsRoot, 'complete', `${fixture.id}-${variant}`);
    if (!transferFailed) {
      await mkdir(destinationDirectory, { recursive: true });
      await copyFile(
        resolve(downloadsRoot, 'controlled-provider-fixtures', buildControlledProviderFixtureFilename(fixture, { variant })),
        resolve(destinationDirectory, buildControlledProviderFixtureFilename(fixture, { variant })),
      );
    }
    accepted.push({
      averageSpeed: 1_000_000,
      bytesTransferred: file.size ?? 65536,
      directory: `\\data\\downloads\\complete\\${fixture.id}-${variant}`,
      endedAt: new Date().toISOString(),
      filename: remoteFilename,
      id: randomUUID(),
      size: file.size ?? 65536,
      startedAt: new Date().toISOString(),
      exception: transferFailed ? 'Controlled provider transfer failure' : null,
      state: transferFailed ? 'Completed, Errored' : 'Completed, Succeeded',
      username,
    });
  }
  transfersByUsername.set(username, [...(transfersByUsername.get(username) ?? []), ...accepted]);
  return { enqueued: accepted, failed: [] };
}

const server = createServer(async (request, response) => {
  try {
    if (request.url === '/_fixture/health') return writeJson(response, 200, { ok: true });
    if (!isAuthorized(request)) return writeJson(response, 401, { error: 'unauthorized' });

    const url = new URL(request.url, 'http://fixture.local');
    const pathname = url.pathname;
    if (request.method === 'GET' && pathname === '/api/v0/application') {
      return writeJson(response, 200, { server: { isConnected: true, isLoggedIn: true }, version: { current: 'controlled-fixture' } });
    }
    if (request.method === 'GET' && pathname === '/api/v0/session') return writeJson(response, 200, true);
    if (request.method === 'POST' && pathname === '/api/v0/searches') {
      const body = await readJson(request);
      const id = randomUUID();
      const search = { fixture: findControlledProviderFixtureBySearchText(body?.searchText), id, pollCount: 0, searchText: body?.searchText ?? '', startedAt: new Date().toISOString() };
      searches.set(id, search);
      return writeJson(response, 200, buildSearchState(search));
    }
    const searchMatch = pathname.match(/^\/api\/v0\/searches\/([^/]+)(?:\/(responses))?$/u);
    if (request.method === 'GET' && searchMatch) {
      const search = searches.get(decodeURIComponent(searchMatch[1]));
      if (!search) return writeJson(response, 404, { error: 'not_found' });
      if (searchMatch[2] === 'responses') return writeJson(response, 200, search.pollCount > 0 ? buildResponse(search.fixture) : []);
      search.pollCount += 1;
      return writeJson(response, 200, buildSearchState(search, { includeResponses: url.searchParams.get('includeResponses') === 'true' }));
    }
    const transferMatch = pathname.match(/^\/api\/v0\/transfers\/downloads\/([^/]+)$/u);
    if (transferMatch) {
      const username = decodeURIComponent(transferMatch[1]);
      if (request.method === 'POST') return writeJson(response, 200, await enqueueTransfers(username, await readJson(request)));
      if (request.method === 'GET') return writeJson(response, 200, listTransfers(username));
    }
    return writeJson(response, 404, { error: 'not_found' });
  } catch (error) {
    return writeJson(response, 500, { error: 'fixture_error', message: error.message, filename: basename(error.path ?? '') });
  }
});

server.listen(port, '0.0.0.0');
