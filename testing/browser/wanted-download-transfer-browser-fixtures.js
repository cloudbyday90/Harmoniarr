/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { buildLinkedDownloaderQueueFixture } from './downloader-browser-fixtures.js';
import {
  queueMetadataImportReviewExecutionReconciliation,
  readMetadataBrowserFixtureState,
} from './metadata-browser-fixtures.js';

export const selectionReadyTransfer = {
  bytesTransferred: 22020096,
  filename: 'Aphex Twin\\Selected Ambient Works 85-92\\01 Xtal.flac',
  id: 'transfer-selection-ready-saw',
  placeInQueue: 0,
  size: 41779200,
  state: 'InProgress',
  username: 'high-confidence-peer',
};

export const selectionReadyDownloaderTransfer = {
  actionEligibility: {
    actions: [
      {
        code: 'cancel',
        destructive: false,
        enabled: true,
        label: 'Cancel',
        reason: 'transfer_can_be_cancelled',
        requiresFreshSession: true,
      },
      {
        code: 'remove',
        destructive: true,
        enabled: false,
        label: 'Remove',
        reason: 'remove_not_allowed_for_active',
        requiresFreshSession: true,
      },
      {
        code: 'retry',
        destructive: false,
        enabled: false,
        label: 'Retry',
        reason: 'retry_provider_contract_not_available',
        requiresFreshSession: true,
      },
    ],
    canCancel: true,
    canClear: false,
    canPause: false,
    canRemove: false,
    canResume: false,
    canRetry: false,
    reason: 'cancel_available',
  },
  averageSpeed: 4096,
  diagnostics: {
    importLinkage: {
      candidateId: 'candidate-selection-ready',
      candidateStatus: 'downloading',
      executionItemStatus: 'queued',
      linkedAt: '2026-06-27T21:32:00.000Z',
      operationRunId: 'execution-run-1',
      requestId: null,
      sourceSearchId: 'search-selection-ready-saw',
      status: 'linked',
      summary: 'Linked to Import Review candidate.',
    },
    provider: {
      hasProviderError: false,
      name: 'slskd',
      state: 'InProgress',
    },
    queue: {
      hasQueuePosition: true,
      placeInQueue: 0,
    },
    recommendedNextAction: {
      code: 'monitor_progress',
      description: 'Keep watching progress and speed before taking operator action.',
      label: 'Monitor progress',
      tone: 'info',
    },
    retry: {
      attempts: null,
      status: 'not_tracked',
      summary: 'Retry attempts are not tracked by Harmoniarr for live provider rows yet.',
    },
    severity: 'info',
    summary: 'The transfer is actively downloading at 53%.',
    timing: {
      lastKnownEventAt: '2026-06-27T21:36:00.000Z',
    },
  },
  directory: 'Aphex Twin\\Selected Ambient Works 85-92',
  filename: selectionReadyTransfer.filename,
  id: selectionReadyTransfer.id,
  placeInQueue: selectionReadyTransfer.placeInQueue,
  progress: {
    bytesTransferred: selectionReadyTransfer.bytesTransferred,
    percentComplete: 53,
    size: selectionReadyTransfer.size,
  },
  sourceUser: selectionReadyTransfer.username,
  state: {
    code: 'active',
    label: 'Downloading',
    raw: selectionReadyTransfer.state,
    terminal: false,
    tone: 'warning',
  },
  timestamps: {
    endedAt: null,
    enqueuedAt: '2026-06-27T21:32:00.000Z',
    requestedAt: '2026-06-27T21:31:00.000Z',
    startedAt: '2026-06-27T21:35:00.000Z',
  },
  transferKey: 'high-confidence-peer::transfer-selection-ready-saw',
};

export function buildSelectionReadyDownloaderQueueFixture() {
  return buildLinkedDownloaderQueueFixture({
    observedAt: '2026-06-27T21:36:00.000Z',
    queueHealth: {
      averageSpeed: selectionReadyDownloaderTransfer.averageSpeed,
      counts: {
        active: 1,
        completed: 0,
        failed: 0,
        other: 0,
        queued: 0,
        total: 1,
      },
      message: '1 active and 0 queued transfer is in the queue.',
      progress: {
        bytesTransferred: selectionReadyTransfer.bytesTransferred,
        percentComplete: 53,
        size: selectionReadyTransfer.size,
      },
      status: 'busy',
    },
    sourceGroups: [{
      counts: {
        active: 1,
        completed: 0,
        failed: 0,
        other: 0,
        queued: 0,
        total: 1,
      },
      sourceUser: selectionReadyTransfer.username,
    }],
    transfers: [selectionReadyDownloaderTransfer],
  });
}

export function buildSelectionReadyAcceptedExecutionRun(currentRun) {
  return {
    ...currentRun,
    currentStep: 'Download transfer state synced from slskd.',
    items: [{
      id: 'execution-item-selection-ready-saw',
      itemStatus: 'queued',
      liveTransferSummary: {
        active: 1,
        bytesTransferred: selectionReadyTransfer.bytesTransferred,
        completed: 0,
        failed: 0,
        message: '1 transfer is actively progressing.',
        percentComplete: 53,
        queued: 0,
        rejected: 0,
        status: 'active',
        total: 1,
        totalBytes: selectionReadyTransfer.size,
      },
      liveTransfers: [selectionReadyTransfer],
      planningSnapshot: {
        candidate: {
          folderPath: '/private/staging/Aphex Twin/Selected Ambient Works 85-92',
          id: 'candidate-selection-ready',
          username: selectionReadyTransfer.username,
        },
        execution: {
          diagnostics: {
            downloadAcceptance: {
              code: 'provider_accepted',
              counts: {
                enqueuedTransfers: 1,
                failedFiles: 0,
                requestedFiles: 1,
              },
              enqueuedTransferIds: ['transfer-selection-ready-saw'],
              message: 'The download provider accepted 1 transfer for this candidate.',
              operatorAction: 'Monitor Downloader until the transfer completes, then continue import review.',
              title: 'Provider accepted transfer',
              tone: 'success',
              warningMessage: null,
            },
          },
        },
        planning: {
          libraryFolderPath: 'Music/Aphex Twin/Selected Ambient Works 85-92',
          sourceFolderPath: '/private/staging/Aphex Twin/Selected Ambient Works 85-92',
          stagingFolderPath: '/data/staging/candidate-selection-ready',
        },
      },
      statusMessage: 'Queued in Downloader and actively progressing.',
      updatedAt: '2026-06-27T21:36:00.000Z',
    }],
    processedCandidateCount: 1,
    queuedCount: 1,
    readyCount: 0,
    status: 'running',
    transferSnapshotUnavailable: false,
  };
}

export async function queueSelectionReadyTransferAcceptance(page) {
  const fixtureState = await readMetadataBrowserFixtureState(page);
  const currentRun = fixtureState.importReviewExecutionSummary?.currentRun;
  if (!currentRun) {
    throw new Error('Expected current import execution run before queuing transfer acceptance.');
  }

  await queueMetadataImportReviewExecutionReconciliation(page, {
    candidateStatuses: {
      'candidate-selection-ready': 'downloading',
    },
    currentRun: buildSelectionReadyAcceptedExecutionRun(currentRun),
    summary: {
      message: 'Download transfer state synced from slskd.',
      status: 'running',
    },
    transitionCount: 1,
  });
}
