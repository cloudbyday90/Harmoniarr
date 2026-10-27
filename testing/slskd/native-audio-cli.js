/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { lstat, readFile } from 'node:fs/promises';
import { createSlskdService } from '../../src/server/slskd/slskd-service.js';
import { createSlskdClient } from '../../src/server/integrations/slskd/slskd-client.js';
import { readNativePartialApi } from './native-partial-api.js';
import { waitForNativeResume } from './native-resume-client.js';
import { nativeAudioFiles, nativeAudioDigest } from './native-audio-data.js';
import { inspectDeclaredNativeBytes } from './native-file-read.js';
import { assertNativeFileTree } from './native-completed-files.js';
import { readNativeProviderObservation } from './native-observer-api.js';

const phase = process.argv[2]; const raw = process.argv[3] ?? '{}'; assert.ok(Buffer.byteLength(raw) <= 16384);
const input = JSON.parse(raw);
const { apiKey, expectedVersion, observerApiKey } = JSON.parse(await readFile('/run/fixture.json', 'utf8'));
const config = { baseUrl: 'http://provider:5030', apiKey, requestTimeoutMs: 2000 };
const observationConfig = { ...config, observerApiKey };
let posts = 0; let postStatus;
const service = createSlskdService({ getClientConfig: async () => ({ ...config }), createSlskdClientFn: options =>
  createSlskdClient({ ...options, fetchImpl: async (url, request) => {
    const response = await fetch(url, request);
    if (request.method === 'POST') { posts++; postStatus = response.status; assert.equal(new URL(url).pathname, '/api/v0/transfers/downloads/batches'); }
    return response;
  } }) });
let result;
if (phase === 'prepare') {
  await waitForNativeResume(() => readNativePartialApi(config, 'application'), value => value.server?.isLoggedIn === true);
  const dispatch = await service.prepareDownloadDispatch(); assert.equal(dispatch.binding.version, expectedVersion);
  result = dispatch.binding;
} else if (phase === 'enqueue') {
  const dispatch = await service.prepareDownloadDispatch();
  result = { result: await dispatch.enqueue({ attempt: input.attempt }), posts, postStatus };
} else if (phase === 'batch') result = await service.getDownloadBatchEvidence(input);
else if (phase === 'bounds') result = await service.getBoundDownloads(input);
else if (phase === 'list') result = await service.getDownloads(input);
else if (phase === 'retire') {
  await waitForNativeResume(() => readNativeProviderObservation(observationConfig, 'debug/transfers'), value => value.soulseek.downloads.length === 0);
  result = { nativeDownloadsRetired: true };
} else if (phase === 'published' || phase === 'inspect') {
  if (phase === 'published') {
    await waitForNativeResume(async () => Promise.all(nativeAudioFiles.map(async file => {
      try { return (await lstat('/downloads/' + file.filename.replaceAll('\\', '/'))).size === file.size; }
      catch (error) { if (error.code === 'ENOENT') return false; throw error; }
    })), ready => ready.every(Boolean));
  }
  await assertNativeFileTree(nativeAudioFiles);
  result = [];
  for (const file of nativeAudioFiles) result.push(await inspectDeclaredNativeBytes('/downloads', file, {
    parts: file.filename.split('\\'), minBytes: file.size, maxBytes: file.size, digestForLength: () => nativeAudioDigest(file),
  }));
} else throw new TypeError('Unreviewed audio bridge operation');
console.log(JSON.stringify(result));
