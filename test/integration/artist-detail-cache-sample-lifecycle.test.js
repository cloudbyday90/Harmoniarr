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
import { applyPendingMigrations } from '../../src/server/migrations.js';
import {
  metadataProviderCacheNamespaces,
} from '../../src/server/metadata/metadata-provider-cache-policy.js';
import { createMetadataProviderResponseCacheStore } from '../../src/server/metadata/metadata-provider-response-cache-store.js';
import { artistDetailCacheSampleCatalog } from '../../testing/metadata/artist-detail-cache-sample-catalog.js';
import {
  collectArtistDetailCacheSampleLifecycleEvidence,
  withArtistDetailCacheSampleUpstreamCallCount,
} from '../../testing/metadata/artist-detail-cache-sample-lifecycle-evidence.js';
import {
  createArtistDetailCacheSampleProviderCalls,
  createCacheBackedArtistDetailSampleServices,
  createObservedArtistDetailCacheService,
  getArtistDetailCacheSampleUpstreamCallCount,
} from '../../testing/metadata/artist-detail-cache-sample-workload-fixtures.js';
import { withDockerizedPostgresDatabase } from '../../testing/postgres-docker-database.js';

const dayMs = 24 * 60 * 60 * 1000;
const expectedSampleCount = artistDetailCacheSampleCatalog.length;
const expectedUpstreamCallCount = expectedSampleCount * 4;

function createMutableClock(start) {
  let nowMs = new Date(start).getTime();

  return {
    advanceBy(milliseconds) {
      if (!Number.isSafeInteger(milliseconds) || milliseconds < 0) {
        throw new Error('clock advance must be a non-negative safe integer');
      }
      nowMs += milliseconds;
    },
    nowFn: () => new Date(nowMs),
  };
}

function createCounts(values, selectedValue) {
  return Object.fromEntries(values.map((value) => [value, value === selectedValue ? expectedSampleCount : 0]));
}

function assertOperationEvidence(operation, { lookup, refresh, state }) {
  assert.deepEqual(operation.cacheLookups, createCounts(['cold', 'fresh', 'stale'], lookup));
  assert.deepEqual(operation.cacheStates, createCounts(['fresh', 'miss', 'stale'], state));
  assert.deepEqual(operation.refreshModes, createCounts(['background', 'foreground', 'none'], refresh));
  assert.equal(operation.responseDurationMs.sampleCount, expectedSampleCount);
  assert.ok(Number.isSafeInteger(operation.responseDurationMs.p95));
  assert.ok(operation.responseDurationMs.p95 >= 0);
}

function assertLifecycleEvidence(evidence, { lookup, phase, refresh, state, upstreamCallCount }) {
  assert.equal(evidence.phase, phase);
  assert.equal(evidence.artistCount, expectedSampleCount);
  assert.equal(evidence.upstreamCallCount, upstreamCallCount);
  assertOperationEvidence(evidence.discography, { lookup, refresh, state });
  assertOperationEvidence(evidence.relatedArtists, { lookup, refresh, state });
}

function getNamespaceMetrics(summary, cacheNamespace) {
  const metrics = summary.namespaces.find((candidate) => candidate.cacheNamespace === cacheNamespace);
  assert.ok(metrics, `expected metrics for ${cacheNamespace}`);
  return metrics;
}

async function waitForBackgroundRefreshes(observability) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const summary = observability.getSummary();
    const complete = [
      metadataProviderCacheNamespaces.musicBrainzArtistReleaseGroups,
      metadataProviderCacheNamespaces.similarArtists,
    ].every((cacheNamespace) => {
      const background = getNamespaceMetrics(summary, cacheNamespace).refreshes.background;
      return background.inFlight === 0 && background.succeeded === expectedSampleCount;
    });
    if (complete) {
      return;
    }
    await new Promise((resolve) => {
      setTimeout(resolve, 10);
    });
  }

  throw new Error('Artist Detail stale-while-revalidate work did not complete');
}

async function collectPhaseEvidence({ observability, phase, providerCalls, services }) {
  const before = getArtistDetailCacheSampleUpstreamCallCount(providerCalls);
  const evidence = await collectArtistDetailCacheSampleLifecycleEvidence({
    ...services,
    phase,
  });
  if (phase === 'stale') {
    await waitForBackgroundRefreshes(observability);
  }

  return withArtistDetailCacheSampleUpstreamCallCount(
    evidence,
    getArtistDetailCacheSampleUpstreamCallCount(providerCalls) - before,
  );
}

test('Artist Detail cache samples prove cold, fresh, SWR, and expired lifecycle evidence', {
  timeout: 60_000,
}, async (t) => {
  await withDockerizedPostgresDatabase({
    run: async ({ getPoolFn }) => {
      await applyPendingMigrations({ getPoolFn });
      const clock = createMutableClock('2026-08-22T12:00:00.000Z');
      const cacheStore = createMetadataProviderResponseCacheStore({ getPoolFn });
      const { cacheService, observability } = createObservedArtistDetailCacheService({
        cacheStore,
        nowFn: clock.nowFn,
      });
      const providerCalls = createArtistDetailCacheSampleProviderCalls();
      const services = createCacheBackedArtistDetailSampleServices({
        cacheService,
        providerCalls,
      });

      const cold = await collectPhaseEvidence({
        observability,
        phase: 'cold',
        providerCalls,
        services,
      });
      assertLifecycleEvidence(cold, {
        lookup: 'cold',
        phase: 'cold',
        refresh: 'foreground',
        state: 'fresh',
        upstreamCallCount: expectedUpstreamCallCount,
      });

      clock.advanceBy(60 * 60 * 1000);
      const fresh = await collectPhaseEvidence({
        observability,
        phase: 'fresh',
        providerCalls,
        services,
      });
      assertLifecycleEvidence(fresh, {
        lookup: 'fresh',
        phase: 'fresh',
        refresh: 'none',
        state: 'fresh',
        upstreamCallCount: 0,
      });

      clock.advanceBy(dayMs);
      const stale = await collectPhaseEvidence({
        observability,
        phase: 'stale',
        providerCalls,
        services,
      });
      assertLifecycleEvidence(stale, {
        lookup: 'stale',
        phase: 'stale',
        refresh: 'background',
        state: 'stale',
        upstreamCallCount: expectedUpstreamCallCount,
      });

      clock.advanceBy((8 * dayMs) + 1);
      const expired = await collectPhaseEvidence({
        observability,
        phase: 'expired',
        providerCalls,
        services,
      });
      assertLifecycleEvidence(expired, {
        lookup: 'cold',
        phase: 'expired',
        refresh: 'foreground',
        state: 'fresh',
        upstreamCallCount: expectedUpstreamCallCount,
      });

      t.diagnostic(JSON.stringify({ cold, expired, fresh, stale }));
    },
  });
});
