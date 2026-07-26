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

function findSoulseekHealth(dependencies) {
  return Array.isArray(dependencies)
    ? dependencies.find((dependency) => dependency?.provider === 'slskd') ?? null
    : null;
}

function buildSoulseekStep(dependencies, healthError) {
  if (healthError) {
    return {
      copy: 'Check the address and API key before Harmoniarr can start downloads.',
      label: 'Check Soulseek connection',
      routeName: 'settings-connections',
      status: 'Needs a check',
      tone: 'warning',
    };
  }

  const health = findSoulseekHealth(dependencies);
  if (health?.status === 'healthy') {
    return {
      copy: health.message || 'Soulseek is connected and ready for downloads.',
      label: 'Manage connection',
      routeName: 'settings-connections',
      status: 'Ready',
      tone: 'success',
    };
  }

  if (health?.status === 'disabled') {
    return {
      copy: health.message || 'Soulseek downloads are turned off. Choose a provider mode when you are ready to download music.',
      label: 'Choose provider mode',
      routeName: 'settings-connections',
      status: 'Optional',
      tone: 'info',
    };
  }

  if (health) {
    return {
      copy: health.message || 'Review the Soulseek address and API key, then test the connection.',
      label: 'Fix connection',
      routeName: 'settings-connections',
      status: 'Needs attention',
      tone: 'danger',
    };
  }

  return {
    copy: 'Add a Soulseek address and API key to enable downloads.',
    label: 'Set up Soulseek',
    routeName: 'settings-connections',
    status: 'Not connected',
    tone: 'warning',
  };
}

/**
 * Builds a short, non-sensitive setup sequence. It deliberately exposes only
 * actionable provider state and never returns connection addresses or secrets.
 */
export function buildSettingsSetupSteps({ dependencies, healthError } = {}) {
  return [
    {
      ...buildSoulseekStep(dependencies, healthError),
      id: 'soulseek',
      title: 'Connect Soulseek',
    },
    {
      copy: 'Choose the completed-download and music-library folders Harmoniarr can use.',
      id: 'folders',
      label: 'Set folders',
      routeName: 'settings-media-storage',
      status: 'Required for downloads',
      title: 'Set your folders',
      tone: 'info',
    },
    {
      copy: 'Choose how often Harmoniarr looks for music and whether safe matches download automatically.',
      id: 'library',
      label: 'Review library behavior',
      routeName: 'settings-library',
      status: 'Recommended',
      title: 'Choose library behavior',
      tone: 'info',
    },
  ];
}
