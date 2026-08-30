/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { createArtistDetailLocalTimingEvidence } from '../../scripts/artist-detail-local-timing-evidence.js';
import {
  createArtistDetailTimingObserver,
  measureArtistDetailLocalTiming,
  measureArtistDetailLocalTimingRuns,
  normalizeLoopbackBaseUrl,
  normalizeArtistDetailRequestTiming,
  resolveArtistDetailTimingInputs,
  writeArtistDetailLocalTimingEvidence,
} from '../../scripts/measure-artist-detail-local-timing.js';

const artistMbid = 'dbe5c8d5-5f05-4f22-b4b1-4f49f91b3a88';

function createFakePage() {
  const listeners = new Map();

  return {
    emit(event, value) {
      for (const listener of listeners.get(event) ?? []) {
        listener(value);
      }
    },
    off(event, listener) {
      listeners.set(event, (listeners.get(event) ?? []).filter((candidate) => candidate !== listener));
    },
    on(event, listener) {
      listeners.set(event, [...(listeners.get(event) ?? []), listener]);
    },
  };
}

function createFakeRequest({ responseEnd, startTime, status = 200, url }) {
  return {
    response: async () => ({ status: () => status }),
    timing: () => ({ responseEnd, startTime }),
    url: () => url,
  };
}

function createMeasurementBrowser() {
  const page = createFakePage();
  let presentationFinished = false;
  let closedBeforePresentation = false;
  const localRequest = createFakeRequest({
    responseEnd: 8,
    startTime: 1_728_000_000_000,
    url: `http://127.0.0.1:47956/api/v1/metadata/musicbrainz/artists/${artistMbid}/local`,
  });
  const operatorRequest = createFakeRequest({
    responseEnd: 6,
    startTime: 1_728_000_000_010,
    url: 'http://127.0.0.1:47956/api/v1/metadata/artists/local-artist-id/operator',
  });
  const discographyRequest = createFakeRequest({
    responseEnd: 9,
    startTime: 1_728_000_000_020,
    url: `http://127.0.0.1:47956/api/v1/metadata/musicbrainz/artists/${artistMbid}/release-groups`,
  });

  page.getByLabel = () => ({ fill: async () => {} });
  page.getByRole = () => ({ click: async () => {}, waitFor: async () => {} });
  page.goto = async (url) => {
    if (!url.includes(`/app/artists/${artistMbid}`)) {
      return;
    }

    for (const request of [localRequest, operatorRequest, discographyRequest]) {
      page.emit('request', request);
      page.emit('requestfinished', request);
    }
  };
  page.setDefaultTimeout = () => {};
  page.waitForURL = async () => {};

  const browserContext = {
    close: async () => {
      closedBeforePresentation = !presentationFinished;
    },
    newPage: async () => page,
  };
  const browser = {
    close: async () => {},
    newContext: async () => browserContext,
  };

  return {
    browser,
    get closedBeforePresentation() {
      return closedBeforePresentation;
    },
    observePresentationFn: async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, 10);
      });
      presentationFinished = true;
      return { observedAtMs: 42, state: 'ready' };
    },
  };
}

test('local Artist Detail timing inputs require a loopback deployment and a file-only password', async () => {
  const inputs = await resolveArtistDetailTimingInputs({
    args: [
      '--artist-mbid', artistMbid,
      '--base-url', 'http://localhost:47956',
      '--no-headless',
      '--password-file', 'C:/secrets/harmoniarr-password',
      '--runs', '3',
      '--username', 'local-admin',
    ],
    readFileFn: async (path, encoding) => {
      assert.equal(path, 'C:/secrets/harmoniarr-password');
      assert.equal(encoding, 'utf8');
      return ' local-password\n';
    },
  });

  assert.deepEqual(inputs, {
    artistMbid,
    baseUrl: 'http://localhost:47956',
    evidencePath: null,
    headless: false,
    password: 'local-password',
    runs: 3,
    timeoutMs: 30_000,
    username: 'local-admin',
  });

  await assert.rejects(
    resolveArtistDetailTimingInputs({
      args: [
        '--artist-mbid', artistMbid,
        '--base-url', 'https://example.com',
        '--password-file', 'C:/secrets/harmoniarr-password',
        '--username', 'local-admin',
      ],
      readFileFn: async () => 'local-password',
    }),
    /base-url must be a loopback HTTP URL/u,
  );
  await assert.rejects(
    resolveArtistDetailTimingInputs({
      args: [
        '--artist-mbid', artistMbid,
        '--password-file', 'C:/secrets/harmoniarr-password',
        '--runs', '6',
        '--username', 'local-admin',
      ],
      readFileFn: async () => 'local-password',
    }),
    /runs must be a positive integer no greater than 5/u,
  );
});

test('local Artist Detail timing runs create bounded summary evidence without sharing a browser session', async () => {
  const measurements = [
    createArtistDetailLocalTimingEvidence({
      capturedAt: '2026-08-29T12:00:00.000Z',
      outcome: 'local_projection',
      presentation: { observedAtMs: 41, state: 'ready' },
      requests: [
        {
          endpoint: 'local_metadata',
          statusFamily: '2xx',
          timing: { clientRequestDurationMs: 10, responseEndMs: 10, startTimeMs: 0 },
        },
        {
          endpoint: 'operator_projection',
          statusFamily: '2xx',
          timing: { clientRequestDurationMs: 20, responseEndMs: 30, startTimeMs: 10 },
        },
      ],
    }),
    createArtistDetailLocalTimingEvidence({
      capturedAt: '2026-08-29T12:01:00.000Z',
      outcome: 'local_projection',
      presentation: { observedAtMs: 83, state: 'ready' },
      requests: [
        {
          endpoint: 'local_metadata',
          statusFamily: '2xx',
          timing: { clientRequestDurationMs: 30, responseEndMs: 30, startTimeMs: 0 },
        },
        {
          endpoint: 'operator_projection',
          statusFamily: '2xx',
          timing: { clientRequestDurationMs: 40, responseEndMs: 70, startTimeMs: 30 },
        },
      ],
    }),
  ];
  const receivedInputs = [];

  const evidence = await measureArtistDetailLocalTimingRuns({
    artistMbid,
    measureTimingFn: async (inputs) => {
      receivedInputs.push(inputs);
      return measurements.shift();
    },
    runs: 2,
  });

  assert.equal(receivedInputs.length, 2);
  assert.equal(evidence.artifactType, 'artist_detail_local_timing_batch');
  assert.equal(evidence.sampleCount, 2);
  assert.equal(evidence.outcomeIsConsistent, true);
  assert.equal(JSON.stringify(evidence).includes(artistMbid), false);
  await assert.rejects(
    measureArtistDetailLocalTimingRuns({ runs: 6 }),
    /no greater than 5/u,
  );
});

test('local Artist Detail timing URL validation blocks credentials and deployment subpaths', () => {
  assert.equal(normalizeLoopbackBaseUrl('http://127.0.0.1:47956/'), 'http://127.0.0.1:47956');
  assert.throws(
    () => normalizeLoopbackBaseUrl('http://user:password@127.0.0.1:47956/'),
    /without credentials/u,
  );
  assert.throws(
    () => normalizeLoopbackBaseUrl('http://127.0.0.1:47956/app'),
    /without credentials, path, query, or fragment/u,
  );
});

test('local Artist Detail timing normalizes Playwright milestones without retaining an absolute request clock', () => {
  assert.deepEqual(normalizeArtistDetailRequestTiming({
    responseEnd: 41.5,
    startTime: 1_728_000_050_000,
  }, 1_728_000_000_000), {
    duration: 41.5,
    responseEnd: 50_041.5,
    startTime: 50_000,
  });
  assert.throws(
    () => normalizeArtistDetailRequestTiming({ responseEnd: -1, startTime: 10 }, 0),
    /request timing is invalid/u,
  );
});

test('local Artist Detail timing observer emits only bounded request observations', async () => {
  const page = createFakePage();
  const observer = createArtistDetailTimingObserver({ artistMbid, page });
  const localRequest = createFakeRequest({
    responseEnd: 8,
    startTime: 1_728_000_000_000,
    url: `http://127.0.0.1:47956/api/v1/metadata/musicbrainz/artists/${artistMbid}/local`,
  });
  const projectionRequest = createFakeRequest({
    responseEnd: 5,
    startTime: 1_728_000_000_011,
    url: 'http://127.0.0.1:47956/api/v1/metadata/artists/local-artist-id/operator',
  });

  page.emit('request', localRequest);
  page.emit('requestfinished', localRequest);
  page.emit('request', projectionRequest);
  page.emit('requestfinished', projectionRequest);

  const [localMetadata, operatorProjection] = await Promise.all([
    observer.waitForCompletion('local_metadata'),
    observer.waitForCompletion('operator_projection'),
  ]);
  observer.stop();

  assert.deepEqual([localMetadata, operatorProjection], [
    {
      endpoint: 'local_metadata',
      statusFamily: '2xx',
      timing: { clientRequestDurationMs: 8, responseEndMs: 8, startTimeMs: 0 },
    },
    {
      endpoint: 'operator_projection',
      statusFamily: '2xx',
      timing: { clientRequestDurationMs: 5, responseEndMs: 16, startTimeMs: 11 },
    },
  ]);
  assert.equal(JSON.stringify([localMetadata, operatorProjection]).includes('local-artist-id'), false);
});

test('local Artist Detail timing waits for presentation evidence before closing its browser context', async () => {
  const measurementBrowser = createMeasurementBrowser();

  const evidence = await measureArtistDetailLocalTiming({
    artistMbid,
    baseUrl: 'http://127.0.0.1:47956',
    launchBrowserFn: async () => measurementBrowser.browser,
    observePresentationFn: measurementBrowser.observePresentationFn,
    password: 'local-password',
    username: 'local-admin',
  });

  assert.equal(measurementBrowser.closedBeforePresentation, false);
  assert.deepEqual(evidence.presentation, { observedAtMs: 42, state: 'ready' });
  assert.equal(evidence.outcome, 'provider_fallback_after_operator_projection');
});

test('local Artist Detail timing evidence remains within the workspace when persisted', async () => {
  const writes = [];
  const evidence = createArtistDetailLocalTimingEvidence({
    capturedAt: '2026-08-29T12:00:00.000Z',
    outcome: 'local_projection',
    presentation: { observedAtMs: 31, state: 'ready' },
    requests: [
      {
        endpoint: 'local_metadata',
        statusFamily: '2xx',
        timing: { clientRequestDurationMs: 5, responseEndMs: 5, startTimeMs: 0 },
      },
      {
        endpoint: 'operator_projection',
        statusFamily: '2xx',
        timing: { clientRequestDurationMs: 7, responseEndMs: 13, startTimeMs: 6 },
      },
    ],
  });

  const evidencePath = await writeArtistDetailLocalTimingEvidence({
    cwd: process.cwd(),
    evidence,
    evidencePath: 'artifacts/artist-detail-local-timing.json',
    mkdirFn: async () => {},
    writeFileFn: async (filePath, content, encoding) => writes.push({ content, encoding, filePath }),
  });

  assert.match(evidencePath, /artifacts/u);
  assert.equal(writes[0].encoding, 'utf8');
  assert.equal(writes[0].content.includes('http'), false);
  await assert.rejects(
    writeArtistDetailLocalTimingEvidence({
      cwd: process.cwd(),
      evidence: { ...evidence, username: 'local-admin' },
      evidencePath: 'artifacts/artist-detail-local-timing.json',
      mkdirFn: async () => {},
      writeFileFn: async () => {},
    }),
    /username is not allowed/u,
  );
  await assert.rejects(
    writeArtistDetailLocalTimingEvidence({
      cwd: process.cwd(),
      evidence,
      evidencePath: '../outside-workspace.json',
      mkdirFn: async () => {},
      writeFileFn: async () => {},
    }),
    /must remain within the working directory/u,
  );
});
