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

import { isBootstrapRequired } from './auth.js';
import { createBootstrapOwnerClaimService } from './bootstrap-owner-claim-service.js';
import { createPathValidationSummary } from './paths/path-validation-summary.js';
import { createSettingsService } from './settings-service.js';

export function createBootstrapStatusService({
  bootstrapOwnerClaimService = createBootstrapOwnerClaimService(),
  getBootstrapRequired = isBootstrapRequired,
  settingsService = createSettingsService(),
} = {}) {
  async function buildBootstrapStatusPayload() {
    const bootstrapRequired = await getBootstrapRequired();

    if (!bootstrapRequired) {
      return {
        bootstrapRequired,
      };
    }

    const settingsPayload = await settingsService.buildSettingsPayload();

    return {
      bootstrapRequired,
      ownerClaim: bootstrapOwnerClaimService.buildBootstrapOwnerClaimStatus(),
      pathValidation: createPathValidationSummary(settingsPayload),
    };
  }

  return {
    buildBootstrapStatusPayload,
  };
}
