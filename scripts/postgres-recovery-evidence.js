/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const requestFlags = ['ledgerPreserved', 'ownershipPreserved', 'queuedRecoveryReused', 'continuationResumed',
  'completedWorkPreserved', 'reviewedDecisionsPreserved', 'duplicateConstraintsVerified', 'retainedRunProtected', 'replayIdempotent'];
const requestCounts = ['restoredRequestCount', 'restoredCollectionCount', 'restoredDecisionCount', 'restoredProviderWorkCount',
  'restoredIntentCount', 'restoredOperationRunCount', 'restoredAuditEventCount', 'finalizedCollectionCount', 'resumedWorkCount'];
const operationFlags = ['originalKeyDecrypts', 'missingKeyRejected', 'wrongKeyRejected', 'activeLeasePreserved', 'queuedWorkUnchanged'];
const operationCounts = ['restoredRunCount', 'restoredSecretCount', 'expiredLeasesReleased', 'cancelledRunCount', 'retryQueuedCount'];

function requireEvidence(condition) {
  if (!condition) throw new Error('PostgreSQL recovery evidence was incomplete or invalid');
}

function projectChecks(value, flags, counts) {
  const projected = {};
  for (const flag of flags) {
    requireEvidence(value?.[flag] === true);
    projected[flag] = true;
  }
  for (const count of counts) {
    requireEvidence(Number.isSafeInteger(value?.[count]) && value[count] > 0 && value[count] <= 10_000);
    projected[count] = value[count];
  }
  return projected;
}

export function buildPostgresRecoveryEvidence(result, { checkedAt = new Date().toISOString() } = {}) {
  requireEvidence(result && /^sha256:[a-f0-9]{64}$/.test(result.imageId)
    && /^[a-f0-9]{64}$/.test(result.archiveSha256)
    && Number.isSafeInteger(result.archiveBytes) && result.archiveBytes > 0 && result.archiveBytes <= 134_217_728
    && Number.isSafeInteger(result.postgresVersion) && result.postgresVersion >= 180006 && result.postgresVersion < 190000
    && Number.isSafeInteger(result.migrationCount) && result.migrationCount > 0 && result.migrationCount < 10_000
    && Number.isSafeInteger(result.anchorCount) && result.anchorCount > 0 && result.anchorCount < 10_000
    && result.schemaPreserved === true && result.failedRestoreRolledBack === true && result.cleanupVerified === true
    && result.requests?.providerNetworkRequests === 0 && result.requests?.acquisitionOperationsExecuted === 0
    && result.operations?.workersStarted === false && Number.isFinite(Date.parse(checkedAt)));
  return {
    schemaVersion: 1, evidenceType: 'generated_fixture_postgres_recovery', status: 'passed',
    checkedAt: new Date(checkedAt).toISOString(), postgresVersion: result.postgresVersion, imageId: result.imageId,
    archive: { format: 'custom', bytes: result.archiveBytes, sha256: result.archiveSha256 },
    schema: { migrationCount: result.migrationCount, anchorCount: result.anchorCount, preserved: true },
    requests: { ...projectChecks(result.requests, requestFlags, requestCounts), providerNetworkRequests: 0, acquisitionOperationsExecuted: 0 },
    operations: { ...projectChecks(result.operations, operationFlags, operationCounts), workersStarted: false },
    failedRestoreRolledBack: true, cleanupVerified: true,
  };
}
