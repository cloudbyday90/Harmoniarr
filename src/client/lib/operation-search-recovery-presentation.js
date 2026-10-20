/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { getSearchContinuationRecoveryMessage } from '../../shared/search-continuation-recovery.js';

export function buildOperationSearchRecovery(run) {
  if (run?.operationType !== 'library_discovery_dispatch'
    || !Array.isArray(run.summary?.failures)
    || !run.summary.failures.some((failure) => getSearchContinuationRecoveryMessage(failure?.code))) return null;
  return {
    message: 'Some saved searches need a new search. Review their current status in Missing Music and choose Search again. A job retry does not renew those searches.',
    label: 'Review searches in Missing Music',
    to: { path: '/app/missing', query: { state: 'action' } },
  };
}
