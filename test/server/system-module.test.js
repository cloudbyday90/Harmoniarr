import assert from 'node:assert/strict';
import test from 'node:test';
import { createSystemModule } from '../../src/server/system-module.js';

test('createSystemModule exposes shared route dependencies from injected services', () => {
  const buildLibraryScanSummary = () => {};
  const buildOnboardingSummary = () => {};
  const buildSettingsPayload = () => {};
  const updateSettings = () => {};
  const getOverview = () => {};
  const dependencyHealthService = {
    getDependencyHealth: () => [],
  };
  const libraryScanSummaryService = {
    buildLibraryScanSummary,
  };
  const onboardingSummaryService = {
    buildOnboardingSummary,
  };
  const settingsService = {
    buildSettingsPayload,
    updateSettings,
  };
  const systemService = {
    getOverview,
  };

  const systemModule = createSystemModule({
    appPort: 4312,
    dependencyHealthService,
    libraryScanSummaryService,
    onboardingSummaryService,
    packageJsonPath: 'ignored-for-test',
    startedAt: new Date('2026-04-28T00:00:00.000Z'),
    settingsService,
    systemService,
  });

  assert.equal(systemModule.dependencyHealthService, dependencyHealthService);
  assert.equal(systemModule.libraryScanSummaryService, libraryScanSummaryService);
  assert.equal(systemModule.onboardingSummaryService, onboardingSummaryService);
  assert.equal(systemModule.settingsService, settingsService);
  assert.equal(systemModule.systemService, systemService);
  assert.deepEqual(systemModule.routeDependencies, {
    appPort: 4312,
    buildLibraryScanSummary,
    buildOnboardingSummary,
    getOverview,
    buildSettingsPayload,
    updateSettings,
  });
});
