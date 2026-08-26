/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

function copyMusicQueueCounts(counts) {
  return {
    linkedTransferCount: counts?.linkedTransferCount,
    totalTransferCount: counts?.totalTransferCount,
  };
}

function copyImportReview(importReview) {
  const currentRun = importReview?.currentRun;
  const diagnostics = Array.isArray(importReview?.diagnostics)
    ? importReview.diagnostics
    : [];

  return {
    currentRun: currentRun
      ? {
          itemCount: currentRun.itemCount,
          queuedCount: currentRun.queuedCount,
          queueFailedCount: currentRun.queueFailedCount,
          requestedCandidateCount: currentRun.requestedCandidateCount,
          status: currentRun.status,
        }
      : null,
    diagnosticCount: importReview?.diagnosticCount,
    diagnostics: diagnostics.map((diagnostic) => ({
      acceptedTransferCount: diagnostic?.acceptedTransferCount,
      code: diagnostic?.code,
      failedFileCount: diagnostic?.failedFileCount,
      requestedFileCount: diagnostic?.requestedFileCount,
    })),
    summaryStatus: importReview?.summaryStatus,
  };
}

function copyPaths(paths) {
  return {
    downloadMappingCount: paths?.downloadMappingCount,
    downloadsRootConfigured: paths?.downloadsRootConfigured,
    slskdBaseUrlConfigured: paths?.slskdBaseUrlConfigured,
    slskdSecretConfigured: paths?.slskdSecretConfigured,
  };
}

function copyProvider(provider) {
  return {
    enabled: provider?.enabled,
    queueCounts: {
      active: provider?.queueCounts?.active,
      completed: provider?.queueCounts?.completed,
      failed: provider?.queueCounts?.failed,
      queued: provider?.queueCounts?.queued,
      total: provider?.queueCounts?.total,
    },
    queueHealthStatus: provider?.queueHealthStatus,
  };
}

function copyReadiness(readiness) {
  return {
    code: readiness?.code,
    label: readiness?.label,
    nextAction: readiness?.nextAction,
    ready: readiness?.ready,
    status: readiness?.status,
    summary: readiness?.summary,
  };
}

function copyRequirements(requirements) {
  return {
    requireAcceptedTransfer: requirements?.requireAcceptedTransfer,
    requireConfiguredProvider: requirements?.requireConfiguredProvider,
    requireDiagnostic: requirements?.requireDiagnostic,
    requireMusicQueueLink: requirements?.requireMusicQueueLink,
    requirePathMapping: requirements?.requirePathMapping,
  };
}

/**
 * Produces the only provider-acceptance data that may be persisted locally.
 *
 * Browser scenario data has to retain temporary user and run context to drive
 * an authenticated UI check. The saved artifact does not: it contains only
 * aggregate counts, configuration presence, fixed diagnostic codes, statuses,
 * and the bounded readiness result. This excludes application endpoints,
 * usernames, run and candidate identifiers, release details, and screenshot
 * paths.
 */
export function createDockerProviderAcceptanceArtifact(validationResult = {}) {
  const musicQueue = copyMusicQueueCounts(validationResult.musicQueue);
  const afterRefresh = validationResult.musicQueue?.afterRefresh;

  if (afterRefresh) {
    musicQueue.afterRefresh = copyMusicQueueCounts(afterRefresh);
  }

  return {
    checkedAt: validationResult.checkedAt,
    importReview: copyImportReview(validationResult.importReview),
    musicQueue,
    paths: copyPaths(validationResult.paths),
    provider: copyProvider(validationResult.provider),
    readiness: copyReadiness(validationResult.readiness),
    requirements: copyRequirements(validationResult.requirements),
  };
}
