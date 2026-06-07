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

const terminalFailureTokens = Object.freeze([
  'aborted',
  'cancelled',
  'canceled',
  'errored',
  'rejected',
  'timedout',
  'timed out',
]);

const transferStateLabels = Object.freeze({
  active: 'Downloading',
  completed: 'Completed',
  failed: 'Failed',
  other: 'Unknown',
  queued: 'Queued',
});

const transferStateTones = Object.freeze({
  active: 'warning',
  completed: 'success',
  failed: 'danger',
  other: 'info',
  queued: 'warning',
});

const downloaderActionDefinitions = Object.freeze([
  Object.freeze({
    code: 'cancel',
    destructive: true,
    label: 'Cancel transfer',
    providerAction: 'cancelDownload',
  }),
  Object.freeze({
    code: 'remove',
    destructive: true,
    label: 'Remove transfer',
    providerAction: 'removeDownload',
  }),
  Object.freeze({
    code: 'retry',
    destructive: false,
    label: 'Retry transfer',
    providerAction: null,
  }),
  Object.freeze({
    code: 'pause',
    destructive: false,
    label: 'Pause transfer',
    providerAction: null,
  }),
  Object.freeze({
    code: 'resume',
    destructive: false,
    label: 'Resume transfer',
    providerAction: null,
  }),
]);

const diagnosticSeverityByState = Object.freeze({
  active: 'info',
  completed: 'success',
  failed: 'attention',
  other: 'unknown',
  queued: 'info',
});

function normalizeState(value) {
  return typeof value === 'string' && value.trim()
    ? value.replace(/\s+/g, ' ').trim()
    : 'Unknown';
}

function normalizeStateKey(value) {
  return normalizeState(value).toLowerCase();
}

function hasException(transfer) {
  return typeof transfer?.exception === 'string' && transfer.exception.trim().length > 0;
}

function includesFailureToken(stateKey) {
  return terminalFailureTokens.some((token) => stateKey.includes(token));
}

function normalizeQueuePosition(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function getLastKnownEventAt(timestamps = {}) {
  const values = [
    timestamps.endedAt,
    timestamps.startedAt,
    timestamps.enqueuedAt,
    timestamps.requestedAt,
  ].filter((value) => typeof value === 'string' && value);

  return values[0] ?? null;
}

function buildStateSummary(state, progress) {
  switch (state.code) {
    case 'active':
      return progress.percentComplete == null
        ? 'The transfer is active, but the provider has not reported a measurable percent yet.'
        : `The transfer is actively downloading at ${progress.percentComplete}%.`;
    case 'queued':
      return 'The transfer is queued and waiting for the provider or remote source.';
    case 'completed':
      return 'The transfer has completed and is ready for downstream import review when applicable.';
    case 'failed':
      return 'The transfer failed or reported a provider error. Raw provider error text is intentionally withheld.';
    default:
      return 'The provider returned a transfer state that Harmoniarr does not recognize yet.';
  }
}

function buildRecommendedNextAction(state) {
  switch (state.code) {
    case 'active':
      return {
        code: 'monitor_progress',
        description: 'Keep watching progress and speed before taking operator action.',
        label: 'Monitor progress',
        tone: 'info',
      };
    case 'queued':
      return {
        code: 'wait_for_source',
        description: 'Wait for the remote source or inspect queue position if this remains queued.',
        label: 'Wait for source',
        tone: 'warning',
      };
    case 'completed':
      return {
        code: 'review_import',
        description: 'Review import workflow status when this transfer is tied to a request or candidate.',
        label: 'Review import',
        tone: 'success',
      };
    case 'failed':
      return {
        code: 'inspect_before_retry',
        description: 'Inspect state, source, and future action eligibility before retrying.',
        label: 'Inspect before retry',
        tone: 'danger',
      };
    default:
      return {
        code: 'review_provider_state',
        description: 'Review the provider state and update Harmoniarr normalization if this state is expected.',
        label: 'Review provider state',
        tone: 'info',
      };
  }
}

function buildAction({
  code,
  enabled,
  reason,
  state,
}) {
  const definition = downloaderActionDefinitions.find((entry) => entry.code === code);
  return {
    code,
    destructive: definition?.destructive ?? false,
    enabled,
    label: definition?.label ?? code,
    reason,
    requiresFreshSession: true,
    state: state.code,
  };
}

export function classifyDownloaderTransferState(transfer) {
  const raw = normalizeState(transfer?.state);
  const stateKey = normalizeStateKey(raw);

  if (includesFailureToken(stateKey) || hasException(transfer)) {
    return {
      code: 'failed',
      label: transferStateLabels.failed,
      raw,
      terminal: true,
      tone: transferStateTones.failed,
    };
  }

  if (stateKey.includes('completed') || stateKey.includes('succeeded')) {
    return {
      code: 'completed',
      label: transferStateLabels.completed,
      raw,
      terminal: true,
      tone: transferStateTones.completed,
    };
  }

  if (stateKey.includes('queued')) {
    return {
      code: 'queued',
      label: transferStateLabels.queued,
      raw,
      terminal: false,
      tone: transferStateTones.queued,
    };
  }

  if (
    stateKey.includes('inprogress')
    || stateKey.includes('in progress')
    || stateKey.includes('initializing')
    || stateKey.includes('negotiating')
  ) {
    return {
      code: 'active',
      label: transferStateLabels.active,
      raw,
      terminal: false,
      tone: transferStateTones.active,
    };
  }

  return {
    code: 'other',
    label: transferStateLabels.other,
    raw,
    terminal: false,
    tone: transferStateTones.other,
  };
}

export function calculateDownloaderTransferProgress(transfer) {
  const size = Number(transfer?.size);
  const bytesTransferred = Number(transfer?.bytesTransferred);

  if (!Number.isFinite(size) || size <= 0) {
    return {
      bytesTransferred: Number.isFinite(bytesTransferred) && bytesTransferred >= 0 ? bytesTransferred : null,
      percentComplete: null,
      size: null,
    };
  }

  if (!Number.isFinite(bytesTransferred)) {
    return {
      bytesTransferred: null,
      percentComplete: null,
      size,
    };
  }

  const safeBytesTransferred = Math.max(0, bytesTransferred);
  return {
    bytesTransferred: safeBytesTransferred,
    percentComplete: Math.min(100, Math.round((safeBytesTransferred / size) * 100)),
    size,
  };
}

export function buildDownloaderActionEligibility(transfer = null) {
  const state = transfer
    ? classifyDownloaderTransferState(transfer)
    : { code: 'other' };
  const canCancel = state.code === 'active' || state.code === 'queued';
  const canRemove = state.code === 'completed' || state.code === 'failed';

  const actions = [
    buildAction({
      code: 'cancel',
      enabled: canCancel,
      reason: canCancel ? 'transfer_can_be_cancelled' : `cancel_not_allowed_for_${state.code}`,
      state,
    }),
    buildAction({
      code: 'remove',
      enabled: canRemove,
      reason: canRemove ? 'terminal_transfer_can_be_removed' : `remove_not_allowed_for_${state.code}`,
      state,
    }),
    buildAction({
      code: 'retry',
      enabled: false,
      reason: 'retry_provider_contract_not_available',
      state,
    }),
    buildAction({
      code: 'pause',
      enabled: false,
      reason: 'pause_provider_contract_not_available',
      state,
    }),
    buildAction({
      code: 'resume',
      enabled: false,
      reason: 'resume_provider_contract_not_available',
      state,
    }),
  ];

  return {
    actions,
    canCancel,
    canClear: false,
    canPause: false,
    canRemove,
    canResume: false,
    canRetry: false,
    reason: canCancel
      ? 'cancel_available'
      : canRemove
        ? 'remove_available'
        : `no_actions_available_for_${state.code}`,
  };
}

export function buildDownloaderTransferDiagnostics(transfer, {
  progress,
  state,
  timestamps,
} = {}) {
  const normalizedState = state ?? classifyDownloaderTransferState(transfer);
  const normalizedProgress = progress ?? calculateDownloaderTransferProgress(transfer);
  const normalizedTimestamps = timestamps ?? {};
  const placeInQueue = normalizeQueuePosition(transfer?.placeInQueue);

  return {
    importLinkage: {
      candidateId: null,
      requestId: null,
      status: 'not_linked',
      summary: 'No request or import-candidate linkage is exposed for this live provider row yet.',
    },
    provider: {
      hasProviderError: hasException(transfer),
      name: 'slskd',
      state: normalizedState.raw,
    },
    queue: {
      hasQueuePosition: placeInQueue !== null,
      placeInQueue,
    },
    recommendedNextAction: buildRecommendedNextAction(normalizedState),
    retry: {
      attempts: null,
      status: 'not_tracked',
      summary: 'Retry attempts are not tracked by Harmoniarr for live provider rows yet.',
    },
    severity: diagnosticSeverityByState[normalizedState.code] ?? 'unknown',
    summary: buildStateSummary(normalizedState, normalizedProgress),
    timing: {
      lastKnownEventAt: getLastKnownEventAt(normalizedTimestamps),
    },
  };
}
