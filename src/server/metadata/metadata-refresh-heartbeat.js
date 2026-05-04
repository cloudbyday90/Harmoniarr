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

import { createIntervalHeartbeatRunner } from '../heartbeat/interval-heartbeat-runner.js';
import { createMetadataRefreshDispatchPolicyService } from './metadata-refresh-dispatch-policy-service.js';
import { createMetadataRefreshHeartbeatState } from './metadata-refresh-heartbeat-state.js';

const defaultHeartbeatIntervalMs = 15 * 60 * 1000;

export function createMetadataRefreshHeartbeat({
  clearIntervalFn = clearInterval,
  getDependencyHealth = async () => [],
  getNow = () => new Date(),
  intervalMs = defaultHeartbeatIntervalMs,
  heartbeatPauseService = null,
  metadataRefreshDispatchPolicyService = createMetadataRefreshDispatchPolicyService(),
  metadataRefreshHeartbeatState = createMetadataRefreshHeartbeatState(),
  metadataRefreshSchedulerService,
  onError = () => {},
  setIntervalFn = setInterval,
  startMetadataArtistRefresh = async () => ({ accepted: true }),
} = {}) {
  if (!metadataRefreshSchedulerService?.getNextDueArtist) {
    throw new Error('metadataRefreshSchedulerService.getNextDueArtist is required');
  }
  if (!metadataRefreshDispatchPolicyService?.resolveDispatchReadiness) {
    throw new Error('metadataRefreshDispatchPolicyService.resolveDispatchReadiness is required');
  }

  async function runTick() {
    const occurredAt = getNow().toISOString();

    try {
      const heartbeatReadiness = await heartbeatPauseService?.resolveHeartbeatReadiness?.({
        operationLabel: 'Metadata refresh',
      }) ?? { allowed: true };

      if (!heartbeatReadiness.allowed) {
        metadataRefreshHeartbeatState.recordHeartbeatOutcome({
          occurredAt,
          outcome: 'skipped',
          pauseCode: heartbeatReadiness.pauseCode,
          pauseMessage: heartbeatReadiness.pauseMessage,
          pauseProvider: heartbeatReadiness.pauseProvider,
          skipReason: 'paused',
          nextRetryAt: heartbeatReadiness.nextRetryAt,
        });
        return {
          nextRetryAt: heartbeatReadiness.nextRetryAt ?? null,
          provider: heartbeatReadiness.pauseProvider ?? null,
          reason: 'paused',
          skipped: true,
        };
      }

      const dependencyStatuses = await getDependencyHealth({ providers: ['musicbrainz'] });
      const dispatchReadiness = metadataRefreshDispatchPolicyService.resolveDispatchReadiness({
        dependencyStatuses,
        now: occurredAt,
      });
      if (!dispatchReadiness.allowed) {
        metadataRefreshHeartbeatState.recordHeartbeatOutcome({
          occurredAt,
          outcome: 'skipped',
          pauseCode: dispatchReadiness.pauseCode,
          pauseMessage: dispatchReadiness.pauseMessage,
          pauseProvider: dispatchReadiness.provider,
          skipReason: 'paused',
          nextRetryAt: dispatchReadiness.nextRetryAt,
        });
        return {
          nextRetryAt: dispatchReadiness.nextRetryAt ?? null,
          provider: dispatchReadiness.provider,
          reason: 'paused',
          skipped: true,
        };
      }

      const dueArtist = await metadataRefreshSchedulerService.getNextDueArtist({ now: occurredAt });
      if (!dueArtist) {
        metadataRefreshHeartbeatState.recordHeartbeatOutcome({
          occurredAt,
          outcome: 'skipped',
          skipReason: 'not_due',
        });
        return { reason: 'not_due', skipped: true };
      }

      await startMetadataArtistRefresh({
        metadataArtistId: dueArtist.metadataArtistId,
        triggerSource: 'heartbeat',
      });
      metadataRefreshHeartbeatState.recordHeartbeatOutcome({
        occurredAt,
        outcome: 'started',
      });
      return {
        metadataArtistId: dueArtist.metadataArtistId,
        skipped: false,
      };
    } catch (error) {
      if (error?.code === 'metadata_artist_refresh_in_progress') {
        metadataRefreshHeartbeatState.recordHeartbeatOutcome({
          occurredAt,
          outcome: 'skipped',
          skipReason: 'run_in_progress',
        });
        return { reason: 'run_in_progress', skipped: true };
      }

      metadataRefreshHeartbeatState.recordHeartbeatOutcome({
        errorMessage: error?.message ?? 'Metadata refresh heartbeat failed',
        occurredAt,
        outcome: 'error',
        skipReason: 'error',
      });
      onError(error);
      return { reason: 'error', skipped: true };
    }
  }

  return createIntervalHeartbeatRunner({
    clearIntervalFn,
    intervalMs,
    onTick: runTick,
    onTickInProgress: async () => {
      const occurredAt = getNow().toISOString();
      metadataRefreshHeartbeatState.recordHeartbeatOutcome({
        occurredAt,
        outcome: 'skipped',
        skipReason: 'tick_in_progress',
      });
      return { reason: 'tick_in_progress', skipped: true };
    },
    setIntervalFn,
  });
}