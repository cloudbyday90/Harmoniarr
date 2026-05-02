import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildLibraryDiscoveryRunDashboardLocation,
  buildLibraryScanRunDashboardLocation,
  buildDashboardRouteQuery,
  getDashboardRouteStateKey,
  normalizeDashboardRouteState,
} from '../../src/client/lib/dashboard-route-state.js';

test('normalizeDashboardRouteState trims route values and drops invalid onboarding modes', () => {
  assert.deepEqual(normalizeDashboardRouteState({
    artworkRunId: ' artwork-run-22 ',
    libraryDiscoveryRunId: ' discovery-run-5 ',
    libraryScanRunId: ' scan-run-8 ',
    onboarding: 'invalid',
  }), {
    artworkRunId: 'artwork-run-22',
    libraryDiscoveryRunId: 'discovery-run-5',
    libraryScanRunId: 'scan-run-8',
    onboardingMode: '',
  });
});

test('buildDashboardRouteQuery emits only non-default dashboard query fields', () => {
  assert.deepEqual(buildDashboardRouteQuery({
    artworkRunId: 'artwork-run-22',
    libraryDiscoveryRunId: 'discovery-run-5',
    libraryScanRunId: 'scan-run-8',
    onboardingMode: 'setup',
  }), {
    artworkRunId: 'artwork-run-22',
    libraryDiscoveryRunId: 'discovery-run-5',
    libraryScanRunId: 'scan-run-8',
    onboarding: 'setup',
  });

  assert.deepEqual(buildDashboardRouteQuery({
    artworkRunId: ' ',
    libraryDiscoveryRunId: '',
    libraryScanRunId: '',
    onboardingMode: '',
  }), {});
});

test('getDashboardRouteStateKey matches equivalent dashboard route states after normalization', () => {
  assert.equal(
    getDashboardRouteStateKey({
      artworkRunId: ' artwork-run-22 ',
      libraryDiscoveryRunId: ' discovery-run-5 ',
      libraryScanRunId: ' scan-run-8 ',
      onboardingMode: 'setup',
    }),
    getDashboardRouteStateKey({
      artworkRunId: 'artwork-run-22',
      libraryDiscoveryRunId: 'discovery-run-5',
      libraryScanRunId: 'scan-run-8',
      onboardingMode: 'setup',
    }),
  );
});

test('dashboard route helpers build library scan and discovery run drill-down locations', () => {
  assert.deepEqual(buildLibraryScanRunDashboardLocation('scan-run-8'), {
    hash: '#library-scan-panel',
    name: 'dashboard',
    query: {
      libraryScanRunId: 'scan-run-8',
    },
  });

  assert.deepEqual(buildLibraryDiscoveryRunDashboardLocation('discovery-run-5'), {
    hash: '#library-discovery-panel',
    name: 'dashboard',
    query: {
      libraryDiscoveryRunId: 'discovery-run-5',
    },
  });
});