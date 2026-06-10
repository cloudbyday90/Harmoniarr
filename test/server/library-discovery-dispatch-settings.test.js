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
import {
  DEFAULT_DISCOVERY_SETTINGS,
  createLibraryDiscoveryDispatchService,
  resolveDiscoverySettings,
} from '../../src/server/library/library-discovery-dispatch-service.js';

test('DEFAULT_DISCOVERY_SETTINGS has expected frozen values', () => {
  assert.equal(DEFAULT_DISCOVERY_SETTINGS.automaticCooldownMs, 6 * 60 * 60 * 1000);
  assert.equal(DEFAULT_DISCOVERY_SETTINGS.dispatchBatchSize, 5);
  assert.equal(DEFAULT_DISCOVERY_SETTINGS.fallbackCooldownMs, 2 * 60 * 60 * 1000);
  assert.equal(DEFAULT_DISCOVERY_SETTINGS.maxSearchAttempts, 3);
});

test('resolveDiscoverySettings returns defaults when called with no arguments', () => {
  const settings = resolveDiscoverySettings();

  assert.deepEqual(settings, {
    automaticCooldownMs: DEFAULT_DISCOVERY_SETTINGS.automaticCooldownMs,
    dispatchBatchSize: DEFAULT_DISCOVERY_SETTINGS.dispatchBatchSize,
    fallbackCooldownMs: DEFAULT_DISCOVERY_SETTINGS.fallbackCooldownMs,
    maxSearchAttempts: DEFAULT_DISCOVERY_SETTINGS.maxSearchAttempts,
  });
});

test('resolveDiscoverySettings returns defaults when called with null', () => {
  const settings = resolveDiscoverySettings(null);

  assert.equal(settings.automaticCooldownMs, DEFAULT_DISCOVERY_SETTINGS.automaticCooldownMs);
  assert.equal(settings.dispatchBatchSize, DEFAULT_DISCOVERY_SETTINGS.dispatchBatchSize);
});

test('resolveDiscoverySettings returns defaults when called with empty object', () => {
  const settings = resolveDiscoverySettings({});

  assert.equal(settings.automaticCooldownMs, DEFAULT_DISCOVERY_SETTINGS.automaticCooldownMs);
  assert.equal(settings.maxSearchAttempts, DEFAULT_DISCOVERY_SETTINGS.maxSearchAttempts);
});

test('resolveDiscoverySettings returns defaults when library namespace is missing', () => {
  const settings = resolveDiscoverySettings({ artwork: { fetchEnabled: true } });

  assert.equal(settings.automaticCooldownMs, DEFAULT_DISCOVERY_SETTINGS.automaticCooldownMs);
  assert.equal(settings.dispatchBatchSize, DEFAULT_DISCOVERY_SETTINGS.dispatchBatchSize);
});

test('resolveDiscoverySettings converts discoveryCooldownHours to milliseconds', () => {
  const settings = resolveDiscoverySettings({
    library: {
      discoveryCooldownHours: 12,
      discoveryFallbackCooldownHours: 4,
    },
  });

  assert.equal(settings.automaticCooldownMs, 12 * 60 * 60 * 1000);
  assert.equal(settings.fallbackCooldownMs, 4 * 60 * 60 * 1000);
});

test('resolveDiscoverySettings returns defaults for partial library settings', () => {
  const settings = resolveDiscoverySettings({
    library: {
      discoveryCooldownHours: 24,
    },
  });

  assert.equal(settings.automaticCooldownMs, 24 * 60 * 60 * 1000);
  assert.equal(settings.dispatchBatchSize, DEFAULT_DISCOVERY_SETTINGS.dispatchBatchSize);
  assert.equal(settings.fallbackCooldownMs, DEFAULT_DISCOVERY_SETTINGS.fallbackCooldownMs);
  assert.equal(settings.maxSearchAttempts, DEFAULT_DISCOVERY_SETTINGS.maxSearchAttempts);
});

test('resolveDiscoverySettings returns defaults for non-integer values', () => {
  const settings = resolveDiscoverySettings({
    library: {
      discoveryCooldownHours: 'six',
      discoveryBatchSize: 2.5,
      discoveryFallbackCooldownHours: NaN,
      maxSearchAttempts: undefined,
    },
  });

  assert.equal(settings.automaticCooldownMs, DEFAULT_DISCOVERY_SETTINGS.automaticCooldownMs);
  assert.equal(settings.dispatchBatchSize, DEFAULT_DISCOVERY_SETTINGS.dispatchBatchSize);
  assert.equal(settings.fallbackCooldownMs, DEFAULT_DISCOVERY_SETTINGS.fallbackCooldownMs);
  assert.equal(settings.maxSearchAttempts, DEFAULT_DISCOVERY_SETTINGS.maxSearchAttempts);
});

test('resolveDiscoverySettings returns all four values when all are valid integers', () => {
  const settings = resolveDiscoverySettings({
    library: {
      discoveryCooldownHours: 48,
      discoveryFallbackCooldownHours: 8,
      discoveryBatchSize: 20,
      maxSearchAttempts: 7,
    },
  });

  assert.equal(settings.automaticCooldownMs, 48 * 60 * 60 * 1000);
  assert.equal(settings.fallbackCooldownMs, 8 * 60 * 60 * 1000);
  assert.equal(settings.dispatchBatchSize, 20);
  assert.equal(settings.maxSearchAttempts, 7);
});

test('dispatchReadyDiscoveryRequests uses settings-derived cooldown from loadSettingsFn', async (t) => {
  const recordDiscoverySearchSuccess = t.mock.fn(async () => {});
  const now = new Date('2026-04-30T14:00:00.000Z');
  const service = createLibraryDiscoveryDispatchService({
    getNow: () => now,
    importCandidateService: {
      ingestSlskdSearchResponses: t.mock.fn(async () => ({ candidateCount: 0, fileCount: 0 })),
    },
    libraryDiscoveryRequestStore: {
      claimNextReadyAutomaticDiscoveryRequest: t.mock.fn(async () => ({
        artistName: 'Boards of Canada',
        metadataReleaseId: 'release-1',
        releaseGroupTitle: 'Music Has the Right to Children',
        releaseTitle: 'Music Has the Right to Children',
        releaseDate: '1998-04-20',
      })),
      markDiscoveryRequestExhausted: t.mock.fn(async () => {}),
      recordDiscoverySearchFailure: t.mock.fn(async () => {}),
      recordDiscoverySearchSuccess,
    },
    loadSettingsFn: async () => ({
      library: {
        discoveryCooldownHours: 24,
        discoveryFallbackCooldownHours: 12,
        discoveryBatchSize: 5,
        maxSearchAttempts: 3,
      },
    }),
    slskdService: {
      startSearch: t.mock.fn(async () => ({ id: 'search-1' })),
    },
  });

  await service.dispatchReadyDiscoveryRequests();

  assert.equal(recordDiscoverySearchSuccess.mock.calls[0].arguments[0].nextSearchAfter, '2026-05-01T14:00:00.000Z');
});

test('dispatchReadyDiscoveryRequests uses settings-derived maxSearchAttempts for exhaustion', async (t) => {
  const markDiscoveryRequestExhausted = t.mock.fn(async () => {});
  const service = createLibraryDiscoveryDispatchService({
    getNow: () => new Date('2026-04-30T14:00:00.000Z'),
    importCandidateService: {
      ingestSlskdSearchResponses: t.mock.fn(async () => ({ candidateCount: 0, fileCount: 0 })),
    },
    libraryDiscoveryRequestStore: {
      claimNextReadyAutomaticDiscoveryRequest: t.mock.fn(async () => ({
        artistName: 'Aphex Twin',
        metadataReleaseId: 'release-saw2',
        releaseGroupTitle: 'Selected Ambient Works Volume II',
        searchAttemptCount: 1,
      })),
      markDiscoveryRequestExhausted,
      recordDiscoverySearchFailure: t.mock.fn(async () => {}),
      recordDiscoverySearchSuccess: t.mock.fn(async () => {}),
    },
    loadSettingsFn: async () => ({
      library: {
        discoveryCooldownHours: 6,
        discoveryFallbackCooldownHours: 2,
        discoveryBatchSize: 1,
        maxSearchAttempts: 2,
      },
    }),
    slskdService: {
      startSearch: t.mock.fn(async () => ({ id: 'search-1' })),
    },
  });

  await service.dispatchReadyDiscoveryRequests();

  assert.equal(markDiscoveryRequestExhausted.mock.callCount(), 1);
  assert.equal(markDiscoveryRequestExhausted.mock.calls[0].arguments[0].searchAttemptCount, 2);
  assert.equal(markDiscoveryRequestExhausted.mock.calls[0].arguments[0].reasonCode, 'discovery_search_attempts_exhausted');
});

test('dispatchReadyDiscoveryRequests uses settings-derived batchSize for loop bound', async (t) => {
  const claimed = [
    { artistName: 'A', metadataReleaseId: 'r1' },
    { artistName: 'B', metadataReleaseId: 'r2' },
    { artistName: 'C', metadataReleaseId: 'r3' },
  ];
  const claimNext = t.mock.fn(async () => claimed.shift() ?? null);
  const service = createLibraryDiscoveryDispatchService({
    getNow: () => new Date('2026-04-30T14:00:00.000Z'),
    importCandidateService: {
      ingestSlskdSearchResponses: t.mock.fn(async () => ({ candidateCount: 1, fileCount: 1 })),
    },
    libraryDiscoveryRequestStore: {
      claimNextReadyAutomaticDiscoveryRequest: claimNext,
      recordDiscoverySearchFailure: t.mock.fn(async () => {}),
      recordDiscoverySearchSuccess: t.mock.fn(async () => {}),
    },
    loadSettingsFn: async () => ({
      library: {
        discoveryCooldownHours: 6,
        discoveryFallbackCooldownHours: 2,
        discoveryBatchSize: 2,
        maxSearchAttempts: 3,
      },
    }),
    slskdService: {
      startSearch: t.mock.fn(async () => ({ id: 'search-1' })),
    },
  });

  const result = await service.dispatchReadyDiscoveryRequests();

  assert.equal(result.attemptedCount, 2);
});

test('dispatchReadyDiscoveryRequests falls back to defaults when loadSettingsFn throws', async (t) => {
  const recordDiscoverySearchSuccess = t.mock.fn(async () => {});
  const now = new Date('2026-04-30T14:00:00.000Z');
  const service = createLibraryDiscoveryDispatchService({
    getNow: () => now,
    importCandidateService: {
      ingestSlskdSearchResponses: t.mock.fn(async () => ({ candidateCount: 0, fileCount: 0 })),
    },
    libraryDiscoveryRequestStore: {
      claimNextReadyAutomaticDiscoveryRequest: t.mock.fn(async () => ({
        artistName: 'Boards of Canada',
        metadataReleaseId: 'release-1',
        releaseGroupTitle: 'Geogaddi',
        releaseTitle: 'Geogaddi',
        releaseDate: '2002-02-18',
      })),
      markDiscoveryRequestExhausted: t.mock.fn(async () => {}),
      recordDiscoverySearchFailure: t.mock.fn(async () => {}),
      recordDiscoverySearchSuccess,
    },
    loadSettingsFn: async () => { throw new Error('DB unavailable'); },
    slskdService: {
      startSearch: t.mock.fn(async () => ({ id: 'search-1' })),
    },
  });

  await service.dispatchReadyDiscoveryRequests();

  assert.equal(recordDiscoverySearchSuccess.mock.calls[0].arguments[0].nextSearchAfter, '2026-04-30T20:00:00.000Z');
});
