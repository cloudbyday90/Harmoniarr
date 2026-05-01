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

import { recordAuditEvent } from './audit.js';
import { createPathValidationService } from './paths/path-validation-service.js';
import { loadSettings, persistSettings } from './settings.js';
import { validateDownloadPathMappingsAgainstSettings } from './paths/download-path-mapping-service.js';
import { normalizeSettingsPatch } from './validators/settings-validator.js';

function applySettingsUpdates(settings, updates) {
  const nextSettings = structuredClone(settings);

  for (const update of updates) {
    nextSettings[update.namespace][update.settingKey] = update.value;
  }

  return nextSettings;
}

export function createSettingsService({
  loadSettingsFn = loadSettings,
  pathValidationService = createPathValidationService(),
  persistSettingsFn = persistSettings,
  recordAuditEventFn = recordAuditEvent,
  validateDownloadMappingsFn = validateDownloadPathMappingsAgainstSettings,
} = {}) {
  async function buildPayloadForSettings(settings) {
    return {
      settings,
      pathValidation: await pathValidationService.validateSettingsPaths(settings),
    };
  }

  async function buildSettingsPayload() {
    const settings = await loadSettingsFn();
    return buildPayloadForSettings(settings);
  }

  async function updateSettings({ patch, actorUserId, requestMetadata }) {
    const updates = normalizeSettingsPatch(patch);
    const currentSettings = await loadSettingsFn();
    const nextSettings = applySettingsUpdates(currentSettings, updates);

    validateDownloadMappingsFn({
      downloadMappings: nextSettings.paths?.downloadMappings,
      downloadsRoot: nextSettings.paths?.downloads,
    });

    const settings = await persistSettingsFn(updates, actorUserId);

    await recordAuditEventFn({
      actorUserId,
      actorType: 'user',
      eventType: 'settings_updated',
      summary: 'Application settings updated',
      details: {
        updatedKeys: updates.map((update) => `${update.namespace}.${update.settingKey}`),
      },
      entityType: 'settings',
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
    });

    return {
      ...(await buildPayloadForSettings(settings)),
      updates,
    };
  }

  return {
    buildSettingsPayload,
    updateSettings,
  };
}