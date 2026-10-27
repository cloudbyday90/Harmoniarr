/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readNativeProviderObservation } from '../../testing/slskd/native-observer-api.js';

test('native observer credentials are projected only to fixed read-only diagnostic calls', async () => {
  const config = { baseUrl: 'http://provider:5030', apiKey: 'download-key', observerApiKey: 'observer-key', requestTimeoutMs: 2000, privateMarker: 'discard' };
  for (const path of ['options', 'debug/transfers']) {
    const result = await readNativeProviderObservation(config, path, { readFn: async (options, actualPath) => {
      assert.equal(actualPath, path); assert.deepEqual(options, { baseUrl: config.baseUrl, apiKey: 'observer-key', requestTimeoutMs: 2000 }); return 'observed';
    } });
    assert.equal(result, 'observed'); assert.equal(config.apiKey, 'download-key');
  }
});

test('unreviewed endpoints cannot receive the privileged observer key', () => {
  for (const path of ['server', 'debug/dump', 'transfers/downloads/batches', 'options/other', '../options', 'debug/transfers?dump=true']) {
    assert.throws(() => readNativeProviderObservation({ observerApiKey: 'private' }, path, { readFn: () => assert.fail('privileged read ran') }), TypeError);
  }
});

test('legacy observation preserves its credential and native Error/null failure', async () => {
  for (const failure of [new Error('original'), null]) {
    await assert.rejects(readNativeProviderObservation({ apiKey: 'legacy-key' }, 'debug/transfers', { readFn: async options => {
      assert.equal(options.apiKey, 'legacy-key'); throw failure;
    } }), error => error === failure);
  }
});
