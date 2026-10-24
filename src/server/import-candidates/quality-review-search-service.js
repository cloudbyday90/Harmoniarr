/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { createApiError } from '../auth.js';
import { createOperationRunLeaseLostError } from '../operation-run-lease-error.js';
import { createRuntimeReporter } from '../runtime-reporter.js';
import { createQualityReviewSearchRunStore } from './quality-review-search-run-store.js';
import { createImportCandidateSearchRevisionStore } from './import-candidate-search-revision-store.js';
import { createQualityReviewSearchWorker } from './quality-review-search-worker.js';
import { advanceQualityReviewSearchProgress, assertQualityReviewSearchProgress, qualityReviewSearchContext, qualityReviewSearchBusy,
  qualityReviewSearchUnavailable } from './quality-review-search-policy.js';

export function createQualityReviewSearchService({ scopeService, commitIntent, recordCheckRequested,
  runStore = createQualityReviewSearchRunStore(), revisionStore = createImportCandidateSearchRevisionStore(),
  onSearchQueued = async () => {}, onDispatchError = error => createRuntimeReporter({ prefix: 'harmoniarr' }).writeError(error, { label: 'qualified rediscovery dispatch deferred' }) } = {}) {
  async function qualifyWindow({ input, scope, queryable, progress = null }) {
    const now = await runStore.now({ queryable });
    if (progress) assertQualityReviewSearchProgress(progress, now);
    const revisionInput = { sourceSearchId: scope.failedCandidate.sourceSearchId, queryable };
    const revision = await revisionStore.readRevision(revisionInput);
    if (!revision) throw qualityReviewSearchBusy();
    const context = qualityReviewSearchContext(input, scope, revision);
    const scan = await scopeService.scanAlternativeWindow(scope, { queryable,
      anchor: progress?.context === context ? progress.anchor : null });
    // The last candidate read/lock precedes the nonwaiting fence.
    if (await revisionStore.lockRevisionNowait(revisionInput) !== revision) throw qualityReviewSearchBusy();
    return advanceQualityReviewSearchProgress({ progress, context, revision, now, scan, failedCandidateId: scope.failedCandidate.id });
  }
  const withCurrentSearchScope = async (input, work) => {
    try { return await scopeService.withCurrentScope(input, work); }
    catch (error) { if (error?.code === '55P03') throw qualityReviewSearchBusy(); throw error; }
  };
  async function request({ appUserId, metadataReleaseId, requestMetadata, intent }) {
    const input = { appUserId, wantedReleaseId: intent.wantedReleaseId, actorUserId: intent.requestedByUserId };
    return withCurrentSearchScope(input, async ({ scope, queryable }) => {
      if (scope.release.metadataReleaseId !== metadataReleaseId) throw qualityReviewSearchUnavailable();
      const active = await runStore.findActive({ wantedReleaseId: input.wantedReleaseId, queryable });
      if (active) return { checkingMatches: true };
      const progress = await qualifyWindow({ input, scope, queryable });
      if (progress.state === 'found') throw qualityReviewSearchUnavailable();
      if (progress.state === 'exhausted') return commitIntent({ appUserId, metadataReleaseId, requestMetadata, intent, queryable, scope });
      if (!await runStore.canAdmit({ actorUserId: input.actorUserId, queryable })) {
        throw createApiError(429, 'quality_review_search_capacity', 'Match checks are busy. Try again shortly.');
      }
      await runStore.createOperationRun({ triggeredByUserId: input.actorUserId, queryable, maxAttempts: 3,
        summary: { ...input, metadataReleaseId, intent, progress, currentStep: 'Checking available matches',
          requestMetadata: { ipAddress: requestMetadata?.ipAddress ?? null, userAgent: requestMetadata?.userAgent?.slice(0, 512) ?? null } } });
      await recordCheckRequested({ ...input, queryable });
      return { checkingMatches: true };
    });
  }
  async function executeStep({ runId, expectedLease }) {
    const prepared = await runStore.getRunById(runId);
    if (!prepared || !['pending', 'running'].includes(prepared.status)) return;
    const input = { appUserId: prepared.summary.appUserId, wantedReleaseId: prepared.summary.wantedReleaseId,
      actorUserId: prepared.summary.actorUserId };
    const result = await withCurrentSearchScope(input, ({ scope, queryable }) => runStore.withOwnedRun({ runId, expectedLease, queryable }, async ({ run }) => {
      if (!['pending', 'running'].includes(run.status)) throw createOperationRunLeaseLostError();
      if (run.cancel_requested_at) {
        if (!await runStore.writeLifecycle({ runId, expectedLease, action: 'cancelled', summary: { currentStep: 'Match check cancelled' }, queryable })) throw createOperationRunLeaseLostError();
        return { cancelled: true };
      }
      const saved = run.summary;
      if (run.triggered_by_user_id !== input.actorUserId) throw qualityReviewSearchUnavailable();
      if (scope.failedCandidate.id !== saved.progress.failedCandidateId || scope.release.metadataReleaseId !== saved.metadataReleaseId) throw qualityReviewSearchUnavailable();
      const progress = await qualifyWindow({ input, scope, queryable, progress: saved.progress });
      const paused = progress.state === 'incomplete';
      if (progress.state === 'exhausted') {
        await commitIntent({ appUserId: input.appUserId, metadataReleaseId: saved.metadataReleaseId,
          requestMetadata: saved.requestMetadata, intent: saved.intent, scope, queryable });
        progress.state = 'consumed';
      }
      if (!await runStore.writeLifecycle({ runId, expectedLease, queryable, action: paused ? 'paused' : 'completed',
        nextAttemptAt: new Date(await runStore.now({ queryable }) + 1000).toISOString(),
        summary: { progress, currentStep: paused ? 'Checking available matches' : progress.state === 'found' ? 'Available matches need review' : 'Search queued' } })) throw createOperationRunLeaseLostError();
      return { paused, queued: progress.state === 'consumed' };
    }));
    if (result === false) throw createOperationRunLeaseLostError();
    if (result?.queued) {
      try { await onSearchQueued({ triggeredByUserId: input.actorUserId, triggerSource: 'quality_review_search' }); }
      catch (error) { try { onDispatchError(error); } catch { /* Publication already committed; retain its outcome. */ } }
    }
    return result;
  }
  return { request, executeStep, worker: createQualityReviewSearchWorker({ runStore, executeStep }), runStore };
}
