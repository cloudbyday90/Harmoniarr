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

/**
 * Reduce the Settings payload to the one deployment-state signal needed by the
 * Setup landing page. This intentionally excludes URLs, secret metadata for
 * unrelated providers, and all editable settings.
 */
const providerModes = new Set(['disabled', 'external', 'managed']);

function normalizeProviderMode(value) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return providerModes.has(normalized) ? normalized : null;
}

export function buildSettingsSetupProgress(settingsPayload) {
  return {
    soulseek: {
      managedDeploymentMissing:
        settingsPayload?.secretStatus?.slskd?.providerModeState === 'managed_deployment_missing',
      providerMode: normalizeProviderMode(settingsPayload?.secretStatus?.slskd?.providerMode),
    },
  };
}
