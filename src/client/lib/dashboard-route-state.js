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

function normalizeRouteValue(value) {
  return typeof value === 'string' ? value.trim() : '';
}

const artworkMaintenancePanelHash = '#artwork-maintenance-panel';
const libraryDiscoveryPanelHash = '#library-discovery-panel';
const libraryScanPanelHash = '#library-scan-panel';

function normalizeOnboardingMode(value) {
  return normalizeRouteValue(value) === 'setup' ? 'setup' : '';
}

export function normalizeDashboardRouteState(query = {}) {
  return {
    artworkRunId: normalizeRouteValue(query.artworkRunId),
    libraryDiscoveryRunId: normalizeRouteValue(query.libraryDiscoveryRunId),
    libraryScanRunId: normalizeRouteValue(query.libraryScanRunId),
    onboardingMode: normalizeOnboardingMode(query.onboarding),
  };
}

export function buildDashboardRouteQuery(state = {}) {
  const artworkRunId = normalizeRouteValue(state.artworkRunId);
  const libraryDiscoveryRunId = normalizeRouteValue(state.libraryDiscoveryRunId);
  const libraryScanRunId = normalizeRouteValue(state.libraryScanRunId);
  const onboardingMode = normalizeOnboardingMode(state.onboardingMode);
  const query = {};

  if (artworkRunId) {
    query.artworkRunId = artworkRunId;
  }

  if (libraryDiscoveryRunId) {
    query.libraryDiscoveryRunId = libraryDiscoveryRunId;
  }

  if (libraryScanRunId) {
    query.libraryScanRunId = libraryScanRunId;
  }

  if (onboardingMode) {
    query.onboarding = onboardingMode;
  }

  return query;
}

export function getDashboardRouteStateKey(state) {
  const normalized = normalizeDashboardRouteState({
    artworkRunId: state?.artworkRunId,
    libraryDiscoveryRunId: state?.libraryDiscoveryRunId,
    libraryScanRunId: state?.libraryScanRunId,
    onboarding: state?.onboardingMode,
  });

  return JSON.stringify([
    normalized.artworkRunId,
    normalized.libraryDiscoveryRunId,
    normalized.libraryScanRunId,
    normalized.onboardingMode,
  ]);
}

export function buildArtworkCleanupRunDashboardLocation(runId) {
  const normalizedRunId = normalizeRouteValue(runId);

  if (!normalizedRunId) {
    return null;
  }

  return {
    hash: artworkMaintenancePanelHash,
    name: 'dashboard',
    query: buildDashboardRouteQuery({ artworkRunId: normalizedRunId }),
  };
}

export function buildLibraryScanRunDashboardLocation(runId) {
  const normalizedRunId = normalizeRouteValue(runId);

  if (!normalizedRunId) {
    return null;
  }

  return {
    hash: libraryScanPanelHash,
    name: 'dashboard',
    query: buildDashboardRouteQuery({ libraryScanRunId: normalizedRunId }),
  };
}

export function buildLibraryDiscoveryRunDashboardLocation(runId) {
  const normalizedRunId = normalizeRouteValue(runId);

  if (!normalizedRunId) {
    return null;
  }

  return {
    hash: libraryDiscoveryPanelHash,
    name: 'dashboard',
    query: buildDashboardRouteQuery({ libraryDiscoveryRunId: normalizedRunId }),
  };
}