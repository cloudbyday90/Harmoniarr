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

const terminalFailureTokens = new Set([
  'aborted',
  'cancelled',
  'canceled',
  'errored',
  'timedout',
  'timed out',
]);

function normalizeTransferState(value) {
  return typeof value === 'string'
    ? value.replace(/\s+/g, ' ').trim()
    : 'Unknown';
}

function normalizeTransferStateKey(value) {
  return normalizeTransferState(value).toLowerCase();
}

function hasException(transfer) {
  return typeof transfer?.exception === 'string' && transfer.exception.trim().length > 0;
}

export function classifySlskdTransferState(transfer) {
  const state = normalizeTransferState(transfer?.state);
  const stateKey = normalizeTransferStateKey(state);
  const isCompleted = stateKey.includes('completed');

  if (!isCompleted) {
    return stateKey.includes('queued')
      ? { code: 'queued', state, terminal: false }
      : { code: 'active', state, terminal: false };
  }

  if (stateKey.includes('succeeded') && !hasException(transfer)) {
    return { code: 'succeeded', state, terminal: true };
  }

  if (stateKey.includes('rejected')) {
    return { code: 'rejected', state, terminal: true };
  }

  for (const token of terminalFailureTokens) {
    if (stateKey.includes(token)) {
      return { code: 'failed', state, terminal: true };
    }
  }

  if (hasException(transfer)) {
    return { code: 'failed', state, terminal: true };
  }

  return { code: 'failed', state, terminal: true };
}

export function isTerminalSlskdTransferState(transfer) {
  return classifySlskdTransferState(transfer).terminal;
}
