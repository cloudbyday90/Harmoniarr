/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createSystemService } from '../../src/server/system-service.js';

function overview({ appleMusicStatusService, onStatus = () => {} } = {}) {
  return createSystemService({ startedAt: new Date(), packageJsonPath: 'unused',
    readPackageMetadataFn: async () => ({ name: 'fixture', version: 'fixture' }), getMigrationStatusFn: async () => ({ applied: 115, pending: [] }),
    getPoolFn: () => ({ query: async () => ({ rows: [{ name: 'fixture' }] }) }),
    settingsService: { buildSettingsPayload: async () => ({ settings: { paths: {} }, pathValidation: {} }) },
    dependencyHealthService: { getDependencyHealth: async () => [] },
    appleMusicStatusService, spotifyOAuthService: { buildStatus: async () => { onStatus(); return { linked: true }; } },
    youtubeOAuthService: { buildStatus: async () => { onStatus(); return { linked: false }; } },
  });
}
test('overview provider projection preserves healthy siblings after local Apple failure', async () => {
  const result = await overview({ appleMusicStatusService: { buildStatus: async () => { throw new Error('PRIVATE'); } } }).getOverview();
  assert.deepEqual(result.providers.spotify, { linked: true });
  assert.deepEqual(result.providers.appleMusic, { provider: 'apple_music', availability: 'unavailable', code: 'provider_status_unavailable' });
  assert.deepEqual(result.providers.statusSummary, { state: 'partial', unavailableProviders: ['appleMusic'] });
});
test('overview provider database failures reject, while dependency-free health projection skips provider reads', async () => {
  let calls = 0;
  const service = overview({ onStatus: () => { calls++; }, appleMusicStatusService: { buildStatus: async () => { calls++; throw Object.assign(new Error('PRIVATE'), { code: 'database_unavailable' }); } } });
  await assert.rejects(service.getOverview(), { status: 503, code: 'database_unavailable' });
  assert.equal(calls, 3); calls = 0;
  const result = await service.getOverview({ includeDependencies: false }); assert.equal(calls, 0);
  assert.deepEqual(result.providers, { appleMusic: null, spotify: null, youtube: null, statusSummary: null });
});
