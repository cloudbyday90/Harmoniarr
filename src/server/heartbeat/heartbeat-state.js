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

function cloneBaseState(state) {
  return {
    lastErrorMessage: state.lastErrorMessage ?? null,
    lastOutcome: state.lastOutcome ?? null,
    lastSkipReason: state.lastSkipReason ?? null,
    lastTickAt: state.lastTickAt ?? null,
    lastTriggeredAt: state.lastTriggeredAt ?? null,
  };
}

export function createHeartbeatState({
  initialState = {},
  normalizeExtraState = () => ({}),
  resolveExtraStateForOutcome = () => ({}),
} = {}) {
  let state = {
    ...cloneBaseState(initialState),
    ...normalizeExtraState(initialState),
  };

  function getHeartbeatState() {
    return {
      ...cloneBaseState(state),
      ...normalizeExtraState(state),
    };
  }

  function recordHeartbeatOutcome({
    errorMessage = null,
    occurredAt,
    outcome,
    skipReason = null,
    ...details
  }) {
    const previousState = state;
    const baseState = {
      ...state,
      lastErrorMessage: errorMessage,
      lastOutcome: outcome,
      lastSkipReason: skipReason,
      lastTickAt: occurredAt,
      lastTriggeredAt: outcome === 'started'
        ? occurredAt
        : state.lastTriggeredAt ?? null,
    };

    state = {
      ...baseState,
      ...resolveExtraStateForOutcome({
        details,
        nextBaseState: baseState,
        previousState,
      }),
    };
  }

  return {
    getHeartbeatState,
    recordHeartbeatOutcome,
  };
}