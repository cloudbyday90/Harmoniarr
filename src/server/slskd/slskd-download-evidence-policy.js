/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

const stateTokens = new Set(['Requested', 'Queued', 'Initializing', 'InProgress', 'Completed', 'Succeeded',
  'Cancelled', 'TimedOut', 'Errored', 'Rejected', 'Aborted', 'Locally', 'Remotely', 'None']);
const restartMessages = new Set(['Application shut down', 'Shutting down']);

export function hasKnownDownloadState(transfer) {
  if (typeof transfer?.state !== 'string') return false;
  const tokens = transfer.state.split(',').map((token) => token.trim());
  if (!tokens.length || new Set(tokens).size !== tokens.length || tokens.some((token) => !stateTokens.has(token))) return false;
  const flags = new Set(tokens);
  const categories = ['Requested', 'Queued', 'Initializing', 'InProgress', 'Completed'].filter((token) => flags.has(token));
  const outcomes = ['Succeeded', 'Cancelled', 'TimedOut', 'Errored', 'Rejected', 'Aborted'].filter((token) => flags.has(token));
  const locations = ['Locally', 'Remotely'].filter((token) => flags.has(token));
  return !flags.has('None') && categories.length === 1 && locations.length <= 1
    && (locations.length === 0 || flags.has('Queued'))
    && (flags.has('Completed') ? outcomes.length === 1 : outcomes.length === 0);
}

/** GET recovery must not mistake a pre-task local record for admitted work. */
export function hasProgressedDownloadEvidence(transfer, { allowRemovedSuccess = true } = {}) {
  if (!hasKnownDownloadState(transfer) || (transfer.exception != null && transfer.exception !== '')) return false;
  const tokens = transfer.state.split(',').map((token) => token.trim());
  if (!tokens.length || new Set(tokens).size !== tokens.length || tokens.some((token) => !stateTokens.has(token))) return false;
  const flags = new Set(tokens);
  const remoteQueued = flags.size === 2 && flags.has('Queued') && flags.has('Remotely');
  const inProgress = flags.size === 1 && flags.has('InProgress');
  const succeeded = flags.size === 2 && flags.has('Completed') && flags.has('Succeeded');
  if (transfer.removed === true) return allowRemovedSuccess && succeeded;
  return remoteQueued || inProgress || succeeded;
}

export function hasProviderRestartEvidence(transfer) {
  return restartMessages.has(transfer?.exception);
}
