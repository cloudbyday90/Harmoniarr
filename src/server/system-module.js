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

import { createLibraryScanSummaryService } from './library-scan-summary-service.js';
import { createOnboardingSummaryService } from './onboarding-summary-service.js';
import { createSettingsService } from './settings-service.js';
import { createDependencyHealthService } from './dependency-health-service.js';
import { createSystemService } from './system-service.js';

export function createSystemModule({
  appPort,
  dependencyHealthService = createDependencyHealthService(),
  musicBrainzSearchService,
  packageJsonPath,
  settingsService = createSettingsService(),
  libraryScanSummaryService = createLibraryScanSummaryService({
    settingsService,
  }),
  slskdService,
  startedAt,
  onboardingSummaryService = createOnboardingSummaryService({
    libraryScanSummaryService,
    musicBrainzSearchService,
    settingsService,
    slskdService,
  }),
  systemService = createSystemService({
    startedAt,
    packageJsonPath,
    dependencyHealthService,
    settingsService,
  }),
} = {}) {
  return {
    dependencyHealthService,
    libraryScanSummaryService,
    onboardingSummaryService,
    settingsService,
    systemService,
    routeDependencies: {
      appPort,
      buildLibraryScanSummary: libraryScanSummaryService.buildLibraryScanSummary,
      buildOnboardingSummary: onboardingSummaryService.buildOnboardingSummary,
      getOverview: systemService.getOverview,
      buildSettingsPayload: settingsService.buildSettingsPayload,
      updateSettings: settingsService.updateSettings,
    },
  };
}
