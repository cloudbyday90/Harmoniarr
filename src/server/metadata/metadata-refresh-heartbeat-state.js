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

import { createHeartbeatState } from '../heartbeat/heartbeat-state.js';

export function createMetadataRefreshHeartbeatState({ initialState = {} } = {}) {
  return createHeartbeatState({
    initialState,
    normalizeExtraState: (state) => ({
      lastPauseCode: typeof state.lastPauseCode === 'string' ? state.lastPauseCode : null,
      lastPauseMessage: typeof state.lastPauseMessage === 'string' ? state.lastPauseMessage : null,
      lastPauseProvider: typeof state.lastPauseProvider === 'string' ? state.lastPauseProvider : null,
      nextRetryAt: typeof state.nextRetryAt === 'string' ? state.nextRetryAt : null,
    }),
    resolveExtraStateForOutcome: ({ details, nextBaseState }) => {
      if (nextBaseState.lastSkipReason !== 'paused') {
        return {
          lastPauseCode: null,
          lastPauseMessage: null,
          lastPauseProvider: null,
          nextRetryAt: null,
        };
      }

      return {
        lastPauseCode: typeof details.pauseCode === 'string' ? details.pauseCode : null,
        lastPauseMessage: typeof details.pauseMessage === 'string' ? details.pauseMessage : null,
        lastPauseProvider: typeof details.pauseProvider === 'string' ? details.pauseProvider : null,
        nextRetryAt: typeof details.nextRetryAt === 'string' ? details.nextRetryAt : null,
      };
    },
  });
}