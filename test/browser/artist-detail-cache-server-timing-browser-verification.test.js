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
import { after, before, suite, test } from 'node:test';
import { isDeepStrictEqual } from 'node:util';
import {
  buildArtistDetailCacheBrowserEvidence,
  buildArtistDetailRequestTimingEvidence,
} from '../../testing/browser/artist-detail-cache-browser-evidence.js';
import { createArtistDetailCacheBrowserEvidenceAppFactory } from '../../testing/browser/artist-detail-cache-browser-evidence-app.js';
import {
  createBrowserSmokeRuntime,
  isSkippableBrowserRuntimeError,
  toBrowserRuntimeUnavailableReason,
} from '../../testing/browser/playwright-smoke-runtime.js';
import { bootstrapAdminThroughUi } from '../../testing/browser/operator-browser-helpers.js';
import { artistDetailCacheSampleCatalog } from '../../testing/metadata/artist-detail-cache-sample-catalog.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { seedMetadataReleaseFixture } from '../../testing/integration/metadata-fixtures.js';

const integrationRuntimeConfig = resolveIntegrationTestRuntimeConfig();
const expectedColdProviderCalls = Object.freeze({
  discography: 1,
  lastFm: 1,
  listenBrainz: 1,
  musicBrainzRelations: 1,
});
const expectedStaleProviderCalls = Object.freeze({
  discography: 2,
  lastFm: 2,
  listenBrainz: 2,
  musicBrainzRelations: 2,
});
const expectedPhaseCacheStates = Object.freeze({
  cold: Object.freeze({ lookup: 'cold', refresh: 'foreground', state: 'fresh' }),
  fresh: Object.freeze({ lookup: 'fresh', refresh: 'none', state: 'fresh' }),
  stale: Object.freeze({ lookup: 'stale', refresh: 'background', state: 'stale' }),
});
const cacheRefreshWaitTimeoutMs = 15_000;
const cacheRefreshWaitIntervalMs = 25;

let browserRuntime;
let cacheEvidenceAppFactory;
let runtimeUnavailableReason = null;

function getProviderEndpointPath(endpoint, artistId) {
  const encodedArtistId = encodeURIComponent(artistId);
  switch (endpoint) {
    case 'discography':
      return `/api/v1/metadata/musicbrainz/artists/${encodedArtistId}/release-groups`;
    case 'related_artists':
      return `/api/v1/metadata/artists/${encodedArtistId}/similar`;
    case 'local_metadata':
      return `/api/v1/metadata/musicbrainz/artists/${encodedArtistId}/local`;
    case 'operator_projection':
      return `/api/v1/metadata/artists/${encodedArtistId}/operator`;
    default:
      throw new Error('Artist Detail browser evidence endpoint is invalid');
  }
}

function waitForArtistDetailResponse(page, endpoint, artistId) {
  const path = getProviderEndpointPath(endpoint, artistId);

  return page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === path;
  });
}

async function readResourceTiming(page, response) {
  return page.evaluate((responseUrl) => {
    const timing = performance.getEntriesByName(responseUrl, 'resource').at(-1);
    if (!timing) {
      return null;
    }

    return {
      durationMs: timing.duration,
      responseEndMs: timing.responseEnd,
      serverTiming: timing.serverTiming.map((metric) => ({
        description: metric.description,
        durationMs: metric.duration,
        name: metric.name,
      })),
      startTimeMs: timing.startTime,
    };
  }, response.url());
}

function getServerTimingHeader(response) {
  const serverTiming = response.headers()['server-timing'];
  assert.equal(typeof serverTiming, 'string');
  return serverTiming;
}

async function captureArtistDetailCachePhase({ baseUrl, page, phase, sample }) {
  const discographyResponse = waitForArtistDetailResponse(page, 'discography', sample.musicBrainzArtistId);
  const relatedArtistsResponse = waitForArtistDetailResponse(page, 'related_artists', sample.musicBrainzArtistId);

  await page.goto(`${baseUrl}/app/artists/${sample.musicBrainzArtistId}`, {
    waitUntil: 'domcontentloaded',
  });

  const [discography, relatedArtists] = await Promise.all([discographyResponse, relatedArtistsResponse]);
  assert.equal(discography.status(), 200);
  assert.equal(relatedArtists.status(), 200);
  await page.getByRole('heading', { exact: true, name: 'Discography' }).waitFor();
  await page.getByText('Fixture discography result', { exact: true }).waitFor();
  await page.getByRole('heading', { exact: true, name: 'Related artists' }).waitFor();
  await page.getByText('Fixture related artist 1', { exact: true }).waitFor();

  const [discographyResourceTiming, relatedArtistsResourceTiming] = await Promise.all([
    readResourceTiming(page, discography),
    readResourceTiming(page, relatedArtists),
  ]);

  return [
    buildArtistDetailCacheBrowserEvidence({
      endpoint: 'discography',
      phase,
      resourceTiming: discographyResourceTiming,
      serverTiming: getServerTimingHeader(discography),
    }),
    buildArtistDetailCacheBrowserEvidence({
      endpoint: 'related_artists',
      phase,
      resourceTiming: relatedArtistsResourceTiming,
      serverTiming: getServerTimingHeader(relatedArtists),
    }),
  ];
}

async function captureLocalOperatorTimingEvidence({
  baseUrl,
  localArtistId,
  musicBrainzArtistId,
  page,
  releaseTitle,
}) {
  const localMetadataResponse = waitForArtistDetailResponse(page, 'local_metadata', musicBrainzArtistId);
  const operatorProjectionResponse = waitForArtistDetailResponse(page, 'operator_projection', localArtistId);

  await page.goto(`${baseUrl}/app/artists/${musicBrainzArtistId}`, {
    waitUntil: 'domcontentloaded',
  });

  const [localMetadata, operatorProjection] = await Promise.all([
    localMetadataResponse,
    operatorProjectionResponse,
  ]);
  assert.equal(localMetadata.status(), 200);
  assert.equal(operatorProjection.status(), 200);
  await page.getByRole('heading', { exact: true, name: 'Discography' }).waitFor();
  await page.getByText(releaseTitle, { exact: true }).waitFor();

  const [localMetadataResourceTiming, operatorProjectionResourceTiming] = await Promise.all([
    readResourceTiming(page, localMetadata),
    readResourceTiming(page, operatorProjection),
  ]);

  return [
    buildArtistDetailRequestTimingEvidence({
      endpoint: 'local_metadata',
      resourceTiming: localMetadataResourceTiming,
    }),
    buildArtistDetailRequestTimingEvidence({
      endpoint: 'operator_projection',
      resourceTiming: operatorProjectionResourceTiming,
    }),
  ];
}

async function waitForProviderCalls(getProviderCalls, expected) {
  const deadline = Date.now() + cacheRefreshWaitTimeoutMs;

  while (Date.now() <= deadline) {
    if (isDeepStrictEqual(getProviderCalls(), expected)) {
      return;
    }
    await new Promise((resolve) => {
      setTimeout(resolve, cacheRefreshWaitIntervalMs);
    });
  }

  assert.deepEqual(getProviderCalls(), expected);
}

function assertPhaseEvidence(evidence, phase) {
  const expectedCache = expectedPhaseCacheStates[phase];
  assert.deepEqual(
    evidence.map(({ cache, endpoint, phase: observedPhase }) => ({ cache, endpoint, phase: observedPhase })),
    ['discography', 'related_artists'].map((endpoint) => ({
      cache: expectedCache,
      endpoint,
      phase,
    })),
  );

  for (const entry of evidence) {
    assert.equal(Number.isSafeInteger(entry.timing.clientRequestDurationMs), true);
    assert.equal(entry.timing.clientRequestDurationMs >= 0, true);
    if (phase === 'cold') {
      assert.equal(Number.isSafeInteger(entry.timing.serverRefreshDurationMs), true);
      assert.equal(entry.timing.serverRefreshDurationMs >= 0, true);
    } else {
      assert.equal(entry.timing.serverRefreshDurationMs, null);
    }
  }
}

function assertLocalOperatorTimingEvidence(evidence) {
  assert.deepEqual(
    evidence.map(({ endpoint }) => endpoint),
    ['local_metadata', 'operator_projection'],
  );

  for (const entry of evidence) {
    assert.equal(Number.isSafeInteger(entry.timing.clientRequestDurationMs), true);
    assert.equal(Number.isSafeInteger(entry.timing.responseEndMs), true);
    assert.equal(Number.isSafeInteger(entry.timing.startTimeMs), true);
    assert.equal(entry.timing.clientRequestDurationMs >= 0, true);
    assert.equal(entry.timing.responseEndMs >= entry.timing.startTimeMs, true);
  }

  assert.equal(
    evidence[0].timing.responseEndMs <= evidence[1].timing.startTimeMs,
    true,
  );
}

suite('Artist Detail cache browser Server-Timing evidence', () => {
  before(async () => {
    try {
      cacheEvidenceAppFactory = createArtistDetailCacheBrowserEvidenceAppFactory();
      browserRuntime = await createBrowserSmokeRuntime({
        config: integrationRuntimeConfig,
        createAppFn: cacheEvidenceAppFactory.createAppFn,
      });
      runtimeUnavailableReason = null;
    } catch (error) {
      if (!isSkippableBrowserRuntimeError(error)) {
        throw error;
      }

      runtimeUnavailableReason = toBrowserRuntimeUnavailableReason(error);
    }
  }, {
    timeout: integrationRuntimeConfig.suiteSetupTimeoutMs,
  });

  after(async () => {
    await browserRuntime?.cleanup();
  }, {
    timeout: integrationRuntimeConfig.suiteTeardownTimeoutMs,
  });

  test('records the real Artist Detail request path across cold, fresh, and stale SWR phases', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    const sample = artistDetailCacheSampleCatalog[0];
    await browserRuntime.runScenario(async ({ baseUrl, getPoolFn, page }) => {
      await bootstrapAdminThroughUi(page, { baseUrl });

      const cold = await captureArtistDetailCachePhase({ baseUrl, page, phase: 'cold', sample });
      assertPhaseEvidence(cold, 'cold');
      assert.deepEqual(cacheEvidenceAppFactory.getProviderCalls(), expectedColdProviderCalls);

      const fresh = await captureArtistDetailCachePhase({ baseUrl, page, phase: 'fresh', sample });
      assertPhaseEvidence(fresh, 'fresh');
      assert.deepEqual(cacheEvidenceAppFactory.getProviderCalls(), expectedColdProviderCalls);

      cacheEvidenceAppFactory.advanceToStalePhase();
      const stale = await captureArtistDetailCachePhase({ baseUrl, page, phase: 'stale', sample });
      assertPhaseEvidence(stale, 'stale');
      await waitForProviderCalls(cacheEvidenceAppFactory.getProviderCalls, expectedStaleProviderCalls);

      const localArtist = await seedMetadataReleaseFixture({
        artistName: 'Local timing artist',
        queryable: getPoolFn(),
        releaseTitle: 'Local operator timing release',
      });
      const localOperator = await captureLocalOperatorTimingEvidence({
        baseUrl,
        localArtistId: localArtist.metadataArtistId,
        musicBrainzArtistId: localArtist.musicBrainzArtistId,
        page,
        releaseTitle: 'Local operator timing release',
      });
      assertLocalOperatorTimingEvidence(localOperator);
      assert.equal(cacheEvidenceAppFactory.getProviderCalls().discography, expectedStaleProviderCalls.discography);

      t.diagnostic(JSON.stringify({ cold, fresh, localOperator, stale }));
      await page.goto('about:blank', { waitUntil: 'load' });
    }, {
      scenarioName: 'artist_detail_cache_server_timing_evidence',
    });
  });
});
