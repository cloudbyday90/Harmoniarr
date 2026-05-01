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

const unavailableSummary = {
  status: 'unavailable',
  message: 'Path validation status is unavailable.',
};

export function createPathValidationSummary(settingsPayload) {
  return {
    checkedAt: settingsPayload?.pathValidation?.checkedAt ?? null,
    configuredDownloadMappings: settingsPayload?.settings?.paths?.downloadMappings?.length ?? 0,
    summary: settingsPayload?.pathValidation?.summary ?? unavailableSummary,
  };
}