/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { createOperationRunOwnedLifecycleStore } from './operation-run-owned-lifecycle-store.js';
import { createOperationRetryPolicyService } from './operation-retry-policy-service.js';

function lifecycleSummary(summary) {
  const result = summary && typeof summary === 'object' && !Array.isArray(summary) ? { ...summary } : {};
  delete result.downloadPreparationProtocol;
  delete result.downloadPreparationClosure;
  return result;
}

export function createOperationRunOwnedLifecycleService({ store = createOperationRunOwnedLifecycleStore(),
  retryPolicyService = createOperationRetryPolicyService() } = {}) {
  const mark = (action, input) => store.withOwnedRun(input, ({ queryable, expectedLease }) => store.writeLifecycle({
    ...input, expectedLease, action, summary: lifecycleSummary(input.summary), queryable }));
  async function markRunFailed(input) {
    return store.withOwnedRun(input, ({ run, queryable, expectedLease }) => {
      const schedule = retryPolicyService.buildRetrySchedule({ attemptCount: run.attempt_count, maxAttempts: run.max_attempts });
      return store.writeLifecycle({ ...input, expectedLease, action: schedule ? 'retry' : 'failed', nextAttemptAt: schedule?.nextAttemptAt ?? null,
        summary: { ...lifecycleSummary(input.summary), ...(schedule ? {
          currentStep: 'Automatic retry scheduled after failed attempt', lastFailureMessage: input.errorMessage,
          retryScheduledAt: schedule.nextAttemptAt } : {}) }, queryable });
    });
  }
  return { markRunStarted: (input) => mark('started', input), markRunCompleted: (input) => mark('completed', input),
    markRunCancelled: (input) => mark('cancelled', input), markRunPaused: (input) => mark('paused', input), markRunFailed };
}
