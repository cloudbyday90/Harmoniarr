/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createSlskdService } from '../../src/server/slskd/slskd-service.js';
import { createSlskdClient } from '../../src/server/integrations/slskd/slskd-client.js';
import { readNativePartialApi, waitForNativePartialState } from './native-partial-api.js';
import { resolveNativeSearchPlan } from './native-search-codec.js';

const phase = process.argv[2]; const raw = process.argv[3] ?? '{}'; assert.ok(Buffer.byteLength(raw) <= 16384);
const input = JSON.parse(raw);
const { apiKey } = JSON.parse(await readFile('/run/fixture.json', 'utf8'));
const config = { baseUrl: 'http://provider:5030', apiKey, requestTimeoutMs: 2000 };
const calls = [];
const service = createSlskdService({ getClientConfig: async () => config, createSlskdClientFn: options =>
  createSlskdClient({ ...options, fetchImpl: async (url, request) => {
    const path = new URL(url).pathname;
    assert.ok(/^\/api\/v0\/searches(?:\/[a-f0-9-]+(?:\/responses)?)?$/u.test(path));
    assert.ok(['GET', 'POST'].includes(request.method));
    if (request.method === 'POST') assert.equal(path, '/api/v0/searches');
    const response = await fetch(url, request); calls.push({ method: request.method, path, status: response.status });
    return response;
  } }) });
let result;
if (phase === 'idle') {
  const searches = await readNativePartialApi(config, 'searches'); assert.equal(searches.length, 0);
  result = { searches: 0 };
} else if (phase === 'start') {
  resolveNativeSearchPlan(input.query);
  await waitForNativePartialState(() => readNativePartialApi(config, 'server'), value => value.isLoggedIn === true);
  const search = await service.startSearch(input);
  assert.equal(calls.filter(call => call.method === 'POST').length, 1);
  assert.equal(calls.find(call => call.method === 'POST').status, 200);
  result = { search, calls };
} else if (phase === 'binding') result = await service.getSearchBinding();
else if (phase === 'state') result = await service.getSearchState(input);
else if (phase === 'responses') result = await service.getSearchResponses(input);
else if (phase === 'finish') {
  result = await waitForNativePartialState(() => service.getSearchState(input), value => value.isComplete);
} else throw new TypeError('Unreviewed native search bridge operation');
console.log(JSON.stringify(result));
