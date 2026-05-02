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

import { createApiError } from '../auth.js';
import { listImportExecutionRunItems } from './import-candidate-execution-repository.js';
import { resolveImportCandidateExecutionHeartbeatConfig } from './import-candidate-execution-heartbeat-config.js';
import { resolveImportCandidateExecutionMissingTransferConfig } from './import-candidate-execution-missing-transfer-config.js';
import { createImportCandidateExecutionHeartbeatState } from './import-candidate-execution-heartbeat-state.js';
import { createImportCandidateExecutionRunStore } from './import-candidate-execution-run-store.js';
import { createSlskdTransferSnapshotService } from '../slskd/slskd-transfer-snapshot-service.js';

function parseIsoDate(value) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeTransferState(state) {
  return typeof state === 'string' ? state : 'Unknown';
}

function isTerminalTransferState(state) {
  const normalized = normalizeTransferState(state);
  return normalized.includes('Completed');
}

function resolveMissingSince(item, now) {
  const execution = item?.planningSnapshot?.execution ?? {};

  return parseIsoDate(execution?.missingTransfer?.missingSince)
    ?? parseIsoDate(execution?.latestTransferSnapshot?.lastSeenAt)
    ?? parseIsoDate(execution?.latestTransferSnapshot?.lastReconciledAt)
    ?? parseIsoDate(execution?.requestedAt)
    ?? parseIsoDate(item?.updatedAt)
    ?? now;
}

function buildMissingTransferSummary({ item, missingTransferConfig, now }) {
  const missingSince = resolveMissingSince(item, now);
  const graceDeadlineAt = new Date(missingSince.getTime() + missingTransferConfig.gracePeriodMs);
  const isPastGracePeriod = now.getTime() >= graceDeadlineAt.getTime();

  return {
    graceDeadlineAt: graceDeadlineAt.toISOString(),
    gracePeriodLabel: missingTransferConfig.gracePeriodLabel,
    gracePeriodMs: missingTransferConfig.gracePeriodMs,
    isPastGracePeriod,
    missingSince: missingSince.toISOString(),
    source: missingTransferConfig.source,
  };
}

function buildLiveTransferSummary(transfers, { item, missingTransferConfig, now }) {
  const total = transfers.length;
  const active = transfers.filter((transfer) => !isTerminalTransferState(transfer.state)).length;
  const failed = transfers.filter((transfer) => String(transfer.exception || '').trim()).length;
  const completed = transfers.filter((transfer) => normalizeTransferState(transfer.state).includes('Completed, Succeeded')).length;
  const queued = transfers.filter((transfer) => normalizeTransferState(transfer.state).includes('Queued')).length;
  const bytesTransferred = transfers.reduce((sum, transfer) => sum + (Number(transfer.bytesTransferred) || 0), 0);
  const totalBytes = transfers.reduce((sum, transfer) => sum + (Number(transfer.size) || 0), 0);

  let status = 'not_found';
  let message = 'No live slskd transfers were found for this execution item.';
  let missingTransfer = null;

  if (total > 0 && active > 0) {
    status = queued > 0 ? 'queued' : 'active';
    message = queued > 0
      ? `${queued} transfer${queued === 1 ? '' : 's'} are still queued or waiting remotely.`
      : `${active} transfer${active === 1 ? '' : 's'} are actively progressing.`;
  } else if (completed > 0 && completed === total && failed === 0) {
    status = 'completed';
    message = `${completed} transfer${completed === 1 ? '' : 's'} completed successfully.`;
  } else if (failed > 0) {
    status = 'failed';
    message = `${failed} transfer${failed === 1 ? '' : 's'} reported a terminal slskd error.`;
  } else {
    missingTransfer = buildMissingTransferSummary({
      item,
      missingTransferConfig,
      now,
    });
    message = missingTransfer.isPastGracePeriod
      ? `No live slskd transfers were found for this execution item after the ${missingTransfer.gracePeriodLabel} grace window; Harmoniarr will treat it as orphaned.`
      : `No live slskd transfers were found for this execution item yet; Harmoniarr will keep reconciling for up to ${missingTransfer.gracePeriodLabel} before treating it as orphaned.`;
  }

  return {
    active,
    bytesTransferred,
    completed,
    failed,
    message,
    missingTransfer,
    percentComplete: totalBytes > 0 ? Math.max(0, Math.min(100, Math.round((bytesTransferred / totalBytes) * 100))) : null,
    queued,
    status,
    total,
    totalBytes,
  };
}

function listRequestedTransfers(items) {
  return items.flatMap((item) => {
    const enqueuedTransfers = item?.planningSnapshot?.execution?.enqueuedTransfers;
    return Array.isArray(enqueuedTransfers) ? enqueuedTransfers : [];
  });
}

function buildPersistedTransferObservation(item) {
  const snapshot = item?.planningSnapshot?.execution?.latestTransferSnapshot;

  if (!snapshot) {
    return null;
  }

  return {
    lastReconciledAt: snapshot.lastReconciledAt ?? null,
    lastSeenAt: snapshot.lastSeenAt ?? null,
    summary: snapshot.summary ?? null,
    transfers: Array.isArray(snapshot.transfers) ? snapshot.transfers : [],
  };
}

function buildPersistedMissingTransfer(item) {
  const missingTransfer = item?.planningSnapshot?.execution?.missingTransfer;

  if (!missingTransfer) {
    return null;
  }

  return {
    graceDeadlineAt: missingTransfer.graceDeadlineAt ?? null,
    gracePeriodLabel: missingTransfer.gracePeriodLabel ?? null,
    gracePeriodMs: missingTransfer.gracePeriodMs ?? null,
    isPastGracePeriod: Boolean(missingTransfer.isPastGracePeriod),
    lastCheckedAt: missingTransfer.lastCheckedAt ?? null,
    message: missingTransfer.message ?? null,
    missingSince: missingTransfer.missingSince ?? null,
    source: missingTransfer.source ?? null,
  };
}

async function reconcileItemTransfers(item, {
  missingTransferConfig,
  now,
  transferSnapshot,
}) {
  const execution = item?.planningSnapshot?.execution ?? {};
  const transfers = Array.isArray(execution.enqueuedTransfers)
    ? execution.enqueuedTransfers.filter((transfer) => transfer?.id && transfer?.username)
    : [];

  if (transfers.length < 1) {
    return {
      ...item,
      liveTransferSummary: null,
      liveTransfers: [],
      persistedMissingTransfer: buildPersistedMissingTransfer(item),
      persistedTransferObservation: buildPersistedTransferObservation(item),
    };
  }

  const normalizedTransfers = transfers.map((transfer) => transferSnapshot.getTransfer({
    id: transfer.id,
    username: transfer.username,
  })).filter(Boolean);

  return {
    ...item,
    liveTransferSummary: buildLiveTransferSummary(normalizedTransfers, {
      item,
      missingTransferConfig,
      now,
    }),
    liveTransfers: normalizedTransfers,
    persistedMissingTransfer: buildPersistedMissingTransfer(item),
    persistedTransferObservation: buildPersistedTransferObservation(item),
  };
}

function buildDisplayRunSummary(run) {
  if (!run) {
    return {
      message: 'No import execution run has been recorded yet.',
      status: 'not_started',
    };
  }

  if (run.status === 'pending' || run.status === 'running') {
    return {
      message: run.currentStep || 'Import execution is in progress.',
      status: 'running',
    };
  }

  if (run.status === 'failed') {
    return {
      message: run.errorMessage
        ? `The latest import execution run failed: ${run.errorMessage}`
        : 'The latest import execution run failed.',
      status: 'failed',
    };
  }

  if (run.executionMode === 'download_enqueue') {
    if ((run.queueFailedCount ?? 0) > 0) {
      return {
        message: `${run.queueFailedCount} candidate${run.queueFailedCount === 1 ? '' : 's'} failed to enqueue for download and need operator attention.`,
        status: 'failed',
      };
    }

    if ((run.blockedCount ?? 0) > 0) {
      return {
        message: `${run.blockedCount} candidate${run.blockedCount === 1 ? '' : 's'} remain blocked and were not enqueued for download.`,
        status: 'blocked',
      };
    }

    if ((run.queuedWithWarningsCount ?? 0) > 0) {
      return {
        message: `${run.queuedWithWarningsCount} candidate${run.queuedWithWarningsCount === 1 ? ' was' : 's were'} enqueued with warnings.`,
        status: 'attention',
      };
    }

    return {
      message: `${run.queuedCount ?? 0} candidate${run.queuedCount === 1 ? ' was' : 's were'} enqueued for download.`,
      status: 'ready',
    };
  }

  if ((run.blockedCount ?? 0) > 0) {
    return {
      message: `${run.blockedCount} planned import candidate${run.blockedCount === 1 ? '' : 's'} are blocked and need operator attention.`,
      status: 'blocked',
    };
  }

  if ((run.readyWithWarningsCount ?? 0) > 0) {
    return {
      message: `${run.readyWithWarningsCount} planned import candidate${run.readyWithWarningsCount === 1 ? ' has' : 's have'} warnings before download behavior exists.`,
      status: 'attention',
    };
  }

  return {
    message: `${run.readyCount ?? 0} planned import candidate${run.readyCount === 1 ? ' is' : 's are'} ready for the next execution slice.`,
    status: 'ready',
  };
}

export function createImportCandidateExecutionSummaryService({
  buildTransferSnapshot = createSlskdTransferSnapshotService().buildTransferSnapshot,
  importCandidateExecutionHeartbeatConfig = resolveImportCandidateExecutionHeartbeatConfig(),
  importCandidateExecutionHeartbeatState = createImportCandidateExecutionHeartbeatState(),
  importCandidateExecutionMissingTransferConfig = resolveImportCandidateExecutionMissingTransferConfig(),
  importCandidateExecutionRunStore = createImportCandidateExecutionRunStore(),
  listImportExecutionRunItemsFn = listImportExecutionRunItems,
} = {}) {
  async function buildRunWithItems(run) {
    if (!run) {
      return null;
    }

    const now = new Date();
    const items = await listImportExecutionRunItemsFn(run.id);
    const transferSnapshot = await buildTransferSnapshot({
      requestedTransfers: listRequestedTransfers(items),
    });

    return {
      ...run,
      items: await Promise.all(items.map((item) => reconcileItemTransfers(item, {
        missingTransferConfig: importCandidateExecutionMissingTransferConfig,
        now,
        transferSnapshot,
      }))),
    };
  }

  async function buildImportCandidateExecutionSummary() {
    const checkedAt = new Date().toISOString();
    const [activeRun, latestRun] = await Promise.all([
      importCandidateExecutionRunStore.getActiveRun(),
      importCandidateExecutionRunStore.getLatestRun(),
    ]);

    const currentRun = await buildRunWithItems(activeRun ?? latestRun);

    return {
      activeRun,
      checkedAt,
      currentRun,
      heartbeat: {
        ...importCandidateExecutionHeartbeatConfig,
        state: importCandidateExecutionHeartbeatState.getHeartbeatState(),
      },
      missingTransferPolicy: importCandidateExecutionMissingTransferConfig,
      latestRun,
      summary: buildDisplayRunSummary(currentRun),
    };
  }

  async function buildImportCandidateExecutionRunDetail({ runId }) {
    const run = await importCandidateExecutionRunStore.getRunById(runId);

    if (!run) {
      throw createApiError(404, 'import_candidate_execution_run_not_found', 'Import execution run not found');
    }

    return {
      checkedAt: new Date().toISOString(),
      run: await buildRunWithItems(run),
    };
  }

  return {
    buildImportCandidateExecutionRunDetail,
    buildImportCandidateExecutionSummary,
  };
}