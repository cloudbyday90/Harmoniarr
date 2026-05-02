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

export function resolveHeartbeatOverviewState(heartbeatState) {
  if (!heartbeatState) {
    return null;
  }

  if (typeof heartbeatState.getHeartbeatState === 'function') {
    return heartbeatState.getHeartbeatState();
  }

  return heartbeatState;
}

function buildHeartbeatMessage(label, state, messages = {}) {
  if (!state?.lastTickAt) {
    return {
      message: messages.waiting ?? `${label} has not recorded a heartbeat outcome yet.`,
      status: 'waiting',
    };
  }

  if (state.lastOutcome === 'error') {
    return {
      message: state.lastErrorMessage ?? messages.error ?? `${label} reported an error.`,
      status: 'error',
    };
  }

  if (state.lastSkipReason === 'paused') {
    return {
      message: state.lastPauseMessage ?? messages.paused ?? `${label} is paused.`,
      status: 'paused',
    };
  }

  if (state.lastOutcome === 'started') {
    return {
      message: messages.started ?? `${label} most recently triggered background work.`,
      status: 'running',
    };
  }

  if (state.lastSkipReason === 'tick_in_progress' || state.lastSkipReason === 'run_in_progress') {
    return {
      message: messages.inProgress ?? `${label} is already processing background work.`,
      status: 'active',
    };
  }

  if (state.lastSkipReason === 'not_due') {
    return {
      message: messages.notDue ?? `No work is currently due for ${label.toLowerCase()}.`,
      status: 'idle',
    };
  }

  return {
    message: messages.skipped ?? `The latest ${label.toLowerCase()} tick skipped new work.`,
    status: 'idle',
  };
}

export function buildHeartbeatOverview({
  config = null,
  heartbeatState = null,
  key,
  label,
  messages = {},
} = {}) {
  const state = resolveHeartbeatOverviewState(heartbeatState);
  if (!config && !state) {
    return null;
  }

  const summary = buildHeartbeatMessage(label, state, messages);
  return {
    intervalLabel: config?.intervalLabel ?? null,
    intervalMs: config?.intervalMs ?? null,
    key,
    label,
    lastErrorMessage: state?.lastErrorMessage ?? null,
    lastPauseProvider: state?.lastPauseProvider ?? null,
    lastSkipReason: state?.lastSkipReason ?? null,
    lastTickAt: state?.lastTickAt ?? null,
    lastTriggeredAt: state?.lastTriggeredAt ?? null,
    message: summary.message,
    mode: config?.mode ?? null,
    nextRetryAt: state?.nextRetryAt ?? null,
    source: config?.source ?? null,
    state,
    status: summary.status,
  };
}

export function buildHeartbeatOverviewList(definitions = []) {
  return definitions.map((definition) => buildHeartbeatOverview(definition)).filter(Boolean);
}