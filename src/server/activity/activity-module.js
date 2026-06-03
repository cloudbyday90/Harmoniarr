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

import { createActivityEventService } from './activity-event-service.js';
import { createActivityEventStore } from './activity-event-store.js';
import { createSourceUserBlocklistService } from './source-user-blocklist-service.js';
import { createSourceUserBulkOperationService } from './source-user-bulk-operation-service.js';
import { createSourceUserIgnoreService } from './source-user-ignore-service.js';
import { createSourceUserIgnoreStore } from './source-user-ignore-store.js';
import { createSourceUserOutcomeLedgerStore } from './source-user-outcome-ledger-store.js';
import { createSourceUserTrustDetailService } from './source-user-trust-detail-service.js';
import { createSourceUserTrustEvidenceService } from './source-user-trust-evidence-service.js';
import { createSourceUserTrustExportService } from './source-user-trust-export-service.js';
import { createSourceUserTrustOverrideService } from './source-user-trust-override-service.js';
import { createSourceUserTrustService } from './source-user-trust-service.js';

/**
 * Activity module factory. Wires together the activity event store and service.
 *
 * @param {object} [options]
 * @param {object} [options.activityEventStore]
 * @param {object} [options.activityEventService]
 * @returns {{ activityEventService, activityEventStore, routeDependencies }}
 */
export function createActivityModule({
  activityEventStore = createActivityEventStore(),
  activityEventService = createActivityEventService({ activityEventStore }),
  listTrustSnapshot = async () => [],
  replaceTrustSnapshot = async () => {},
  onTrustOverrideFn = async () => {},
  onBlockEventFn = async () => {},
  onTrustThresholdCrossedFn = async () => {},
  sourceUserOutcomeLedgerStore = createSourceUserOutcomeLedgerStore(),
  sourceUserIgnoreStore = createSourceUserIgnoreStore(),
  sourceUserIgnoreService = createSourceUserIgnoreService({
    ignoreStore: sourceUserIgnoreStore,
  }),
  sourceUserBlocklistService = createSourceUserBlocklistService({
    listTrustSnapshot,
    replaceTrustSnapshot,
    onBlockEventFn,
  }),
  sourceUserTrustService = createSourceUserTrustService({
    listTrustSnapshot,
  }),
  sourceUserTrustDetailService = createSourceUserTrustDetailService({
    listTrustSnapshot,
    listRecentOutcomeEventsFn: sourceUserOutcomeLedgerStore.listRecentOutcomeEvents,
  }),
  sourceUserTrustExportService = createSourceUserTrustExportService({
    listTrustSnapshot,
  }),
  sourceUserTrustEvidenceService = createSourceUserTrustEvidenceService({
    appendOutcomeEventFn: sourceUserOutcomeLedgerStore.appendOutcomeEvent,
    listRecentOutcomeEventsFn: sourceUserOutcomeLedgerStore.listRecentOutcomeEvents,
    listTrustSnapshot,
    onAutoIgnoreEvaluationFn: sourceUserIgnoreService.evaluateAutoIgnoreForUser,
    onTrustThresholdCrossedFn,
    replaceTrustSnapshot,
  }),
  sourceUserTrustOverrideService = createSourceUserTrustOverrideService({
    listTrustSnapshot,
    replaceTrustSnapshot,
    onTrustOverrideFn,
  }),
  sourceUserBulkOperationService = createSourceUserBulkOperationService({
    blockSourceUser: sourceUserBlocklistService.blockSourceUser,
    updateSourceUserTrust: sourceUserTrustOverrideService.updateSourceUserTrust,
  }),
} = {}) {
  return {
    activityEventService,
    activityEventStore,
    sourceUserBlocklistService,
    sourceUserBulkOperationService,
    sourceUserIgnoreService,
    sourceUserIgnoreStore,
    sourceUserOutcomeLedgerStore,
    sourceUserTrustDetailService,
    sourceUserTrustExportService,
    sourceUserTrustEvidenceService,
    sourceUserTrustOverrideService,
    sourceUserTrustService,
    routeDependencies: {
      blockSourceUser: sourceUserBlocklistService.blockSourceUser,
      bulkBlockSourceUsers: sourceUserBulkOperationService.bulkBlockSourceUsers,
      bulkUpdateSourceUserTrust: sourceUserBulkOperationService.bulkUpdateSourceUserTrust,
      buildActivityFeed: activityEventService.buildActivityFeed,
      exportSourceUserTrustHistory: sourceUserTrustExportService.exportSourceUserTrustHistory,
      getSourceUserDetail: sourceUserTrustDetailService.getSourceUserDetail,
      applyIgnoreSuggestion: sourceUserIgnoreService.applyIgnoreSuggestion,
      listIgnoredSourceUsers: sourceUserIgnoreService.listIgnoredSourceUsers,
      listSourceUserAutoIgnoreSuggestions: sourceUserTrustEvidenceService.listSourceUserAutoIgnoreSuggestions,
      removeIgnoredSourceUser: sourceUserIgnoreService.removeIgnoredUser,
      listBlockedSourceUsers: sourceUserBlocklistService.listBlockedSourceUsers,
      listSourceUsers: sourceUserTrustService.listSourceUsers,
      updateSourceUserTrust: sourceUserTrustOverrideService.updateSourceUserTrust,
      unblockSourceUser: sourceUserBlocklistService.unblockSourceUser,
    },
  };
}
