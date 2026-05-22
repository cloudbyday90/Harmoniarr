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

import { createFulfillmentEvidenceStore } from './fulfillment-evidence-store.js';
import { createFulfillmentEvidenceService } from './fulfillment-evidence-service.js';

export function createFulfillmentModule({
  fulfillmentEvidenceStore = createFulfillmentEvidenceStore(),
} = {}) {
  const fulfillmentEvidenceService = createFulfillmentEvidenceService({
    fulfillmentEvidenceStore,
  });

  return {
    fulfillmentEvidenceService,
    fulfillmentEvidenceStore,
    routeDependencies: {
      deleteExpiredFulfillmentEvidence: fulfillmentEvidenceService.deleteExpiredEvidence,
      getFulfillmentEvidenceSummary: fulfillmentEvidenceService.getEvidenceSummary,
      listEvidenceForActivityEvent: fulfillmentEvidenceService.listEvidenceForActivityEvent,
    },
  };
}
