/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  browserRuntimeDiagnosticEnabledEnvVar,
  browserRuntimeDiagnosticMarker,
  createBrowserRuntimeDiagnostic,
  createBrowserRuntimeDiagnosticObserver,
  emitBrowserRuntimeDiagnostic,
  isBrowserRuntimeDiagnosticEnabled,
} from '../../testing/browser/browser-runtime-diagnostic.js';

function createPage() {
  const listeners = new Map();

  return {
    emit(eventName, value) {
      listeners.get(eventName)?.(value);
    },
    evaluate: async () => ({
      documentReadyState: 'interactive',
      domContentLoadedMs: 240.4,
      loadMs: 480.6,
    }),
    on(eventName, listener) {
      listeners.set(eventName, listener);
    },
    url() {
      return 'http://127.0.0.1:47956/app/artists/private-artist-id';
    },
  };
}

test('browser runtime diagnostic collects bounded categories without browser content', async () => {
  let time = 1_000;
  const page = createPage();
  const observer = createBrowserRuntimeDiagnosticObserver(page, {
    now: () => time,
  });
  const request = {
    url: () => 'http://127.0.0.1:47956/api/artists/private-artist-id',
  };

  page.emit('request', request);
  page.emit('requestfailed', request);
  page.emit('response', {
    request: () => request,
    status: () => 503,
  });
  page.emit('console', { type: () => 'error' });
  page.emit('pageerror');
  time = 4_200;

  const diagnostic = await createBrowserRuntimeDiagnostic({
    error: new Error("Timeout 30000ms waiting for getByRole('heading', { name: 'Private Artist' })"),
    observer,
    scenarioName: 'artist_detail_cache_samples',
  });

  assert.deepEqual(diagnostic, {
    error: {
      category: 'timeout',
      readinessTarget: 'heading',
    },
    network: {
      apiRequestCount: 1,
      apiRequestFailureCount: 1,
      apiResponseCount: 1,
      responseStatusCounts: {
        '2xx': 0,
        '3xx': 0,
        '4xx': 0,
        '5xx': 1,
        other: 0,
      },
    },
    page: {
      consoleErrorCount: 1,
      documentReadyState: 'interactive',
      pageErrorCount: 1,
      routeCategory: 'artist_detail',
    },
    scenarioCategory: 'artist_detail',
    timing: {
      domContentLoadedMs: 240,
      elapsedMs: 3_200,
      loadMs: 481,
    },
  });
  assert.equal(JSON.stringify(diagnostic).includes('private-artist-id'), false);
  assert.equal(JSON.stringify(diagnostic).includes('Private Artist'), false);
});

test('browser runtime diagnostic only enables with an explicit environment flag', () => {
  assert.equal(isBrowserRuntimeDiagnosticEnabled({}), false);
  assert.equal(isBrowserRuntimeDiagnosticEnabled({ [browserRuntimeDiagnosticEnabledEnvVar]: 'true' }), false);
  assert.equal(isBrowserRuntimeDiagnosticEnabled({ [browserRuntimeDiagnosticEnabledEnvVar]: '1' }), true);
});

test('browser runtime diagnostic writes one parseable, marked record', () => {
  const writes = [];
  emitBrowserRuntimeDiagnostic({ scenarioCategory: 'other' }, {
    write: (content) => writes.push(content),
  });

  assert.equal(writes.length, 1);
  assert.equal(writes[0].startsWith(browserRuntimeDiagnosticMarker), true);
  assert.equal(writes[0].endsWith('\n'), true);
});
