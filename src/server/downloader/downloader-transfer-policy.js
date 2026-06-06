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

export function buildDownloaderActionEligibility() {
  return {
    canCancel: false,
    canClear: false,
    canRetry: false,
    reason: 'actions_not_designed',
  };
}
