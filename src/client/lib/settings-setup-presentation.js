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

import { buildSettingsSoulseekProviderState } from './settings-provider-state-presentation.js';

function findSoulseekHealth(dependencies) {
  return Array.isArray(dependencies)
    ? dependencies.find((dependency) => dependency?.provider === 'slskd') ?? null
    : null;
}

function buildSoulseekStep({
  connectionErrorCode,
  connectionStatus,
  dependencies,
  healthError,
  setupProgress,
} = {}) {
  const fallbackHealth = findSoulseekHealth(dependencies);
  const providerState = buildSettingsSoulseekProviderState({
    connectionErrorCode: connectionErrorCode || (healthError ? 'connection_check_failed' : null),
    connectionStatus: connectionStatus ?? fallbackHealth,
    providerMode: setupProgress?.soulseek?.providerMode,
    providerModeState: setupProgress?.soulseek?.managedDeploymentMissing
      ? 'managed_deployment_missing'
      : null,
  });

  return {
    copy: providerState.message,
    label: providerState.actionLabel,
    routeName: 'settings-connections',
    status: providerState.statusLabel,
    tone: providerState.tone,
  };
}

function buildFoldersStep(setupProgress, setupProgressError) {
  const folders = setupProgress?.folders;
  const hasRequiredFolders = Boolean(folders?.downloadsConfigured && folders?.musicConfigured);

  if (setupProgressError) {
    return {
      copy: 'Harmoniarr could not confirm the saved media folders. Open Media & storage to review them.',
      label: 'Review folders',
      routeName: 'settings-media-storage',
      status: 'Needs a check',
      tone: 'warning',
    };
  }

  if (!hasRequiredFolders) {
    return {
      copy: 'Choose the completed-download and music-library folders Harmoniarr can use.',
      label: 'Set folders',
      routeName: 'settings-media-storage',
      status: 'Folders needed',
      tone: 'warning',
    };
  }

  if (folders?.validationStatus === 'healthy') {
    return {
      copy: 'Completed downloads and the music library are available to Harmoniarr.',
      label: 'Manage folders',
      routeName: 'settings-media-storage',
      status: 'Ready',
      tone: 'success',
    };
  }

  return {
    copy: 'Saved media folders need attention before Harmoniarr can safely use them.',
    label: 'Review folders',
    routeName: 'settings-media-storage',
    status: 'Needs attention',
    tone: folders?.validationStatus === 'degraded' ? 'warning' : 'danger',
  };
}

function buildLibraryStep() {
  return {
    copy: 'Choose how often Harmoniarr looks for music and whether safe matches download automatically.',
    id: 'library',
    label: 'Review library behavior',
    routeName: 'settings-library',
    status: 'Optional',
    title: 'Choose library behavior',
    tone: 'info',
  };
}

function buildReadinessStatus(coreSteps) {
  const completedCoreSteps = coreSteps.filter((step) => step.tone === 'success').length;
  const remainingCoreSteps = coreSteps.length - completedCoreSteps;

  if (remainingCoreSteps === 0) {
    return {
      copy: 'Soulseek and your media folders are ready for normal download and library work.',
      label: 'Ready for downloads',
      tone: 'success',
    };
  }

  return {
    copy: `${remainingCoreSteps} required setup ${remainingCoreSteps === 1 ? 'task remains' : 'tasks remain'} before Harmoniarr can download music.`,
    label: `${completedCoreSteps} of ${coreSteps.length} ready`,
    tone: 'warning',
  };
}

function buildNextStep(coreSteps) {
  return coreSteps.find((step) => step.tone !== 'success') ?? null;
}

/**
 * Builds a compact, non-sensitive setup overview. Core readiness deliberately
 * includes only the connection and media prerequisites; library tuning remains
 * available as an optional follow-up instead of competing for attention.
 */
export function buildSettingsSetupOverview({
  connectionErrorCode,
  connectionStatus,
  dependencies,
  healthError,
  setupProgress,
  setupProgressError,
} = {}) {
  const coreSteps = [
    {
      ...buildSoulseekStep({
        connectionErrorCode,
        connectionStatus,
        dependencies,
        healthError,
        setupProgress,
      }),
      id: 'soulseek',
      title: 'Connect Soulseek',
    },
    {
      ...buildFoldersStep(setupProgress, setupProgressError),
      id: 'folders',
      title: 'Set your folders',
    },
  ];

  return {
    coreSteps,
    nextStep: buildNextStep(coreSteps),
    optionalSteps: [buildLibraryStep()],
    readiness: buildReadinessStatus(coreSteps),
  };
}

/**
 * Builds a short, non-sensitive setup sequence. It deliberately exposes only
 * actionable provider state and never returns connection addresses or secrets.
 */
export function buildSettingsSetupSteps({
  connectionErrorCode,
  connectionStatus,
  dependencies,
  healthError,
  setupProgress,
} = {}) {
  const overview = buildSettingsSetupOverview({
    connectionErrorCode,
    connectionStatus,
    dependencies,
    healthError,
    setupProgress,
  });
  return [...overview.coreSteps, ...overview.optionalSteps];
}
