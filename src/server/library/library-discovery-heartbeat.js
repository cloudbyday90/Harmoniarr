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

import { createLibraryDiscoveryHeartbeatState } from './library-discovery-heartbeat-state.js';
import { createIntervalHeartbeatRunner } from '../heartbeat/interval-heartbeat-runner.js';

const defaultHeartbeatIntervalMs = 15 * 60 * 1000;

function parseIsoDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isStale({ intervalMs, lastEvaluatedAt, now }) {
  const lastEvaluatedDate = parseIsoDate(lastEvaluatedAt);
  if (!lastEvaluatedDate) {
    return true;
  }

  return now.getTime() - lastEvaluatedDate.getTime() >= intervalMs;
}

export function shouldStartLibraryDiscoveryHeartbeatRun({
  activeRun,
  intervalMs = defaultHeartbeatIntervalMs,
  now,
  snapshot,
}) {
  if (activeRun) {
    return false;
  }

  const requestCounts = snapshot?.requestCounts ?? {
    ready: 0,
    totalRequests: 0,
  };

  if (requestCounts.ready > 0) {
    return true;
  }

  const nextEligibleAt = parseIsoDate(snapshot?.nextEligibleAt);
  if (nextEligibleAt && nextEligibleAt.getTime() <= now.getTime()) {
    return true;
  }

  return isStale({ intervalMs, lastEvaluatedAt: snapshot?.lastEvaluatedAt, now });
}

export function createLibraryDiscoveryHeartbeat({
  clearIntervalFn = clearInterval,
  getActiveRun = async () => null,
  getDiscoverySnapshot = async () => ({
    lastEvaluatedAt: null,
    nextEligibleAt: null,
    requestCounts: {
      blocked: 0,
      cooldown: 0,
      ready: 0,
      totalRequests: 0,
    },
  }),
  getNow = () => new Date(),
  heartbeatPauseService = null,
  intervalMs = defaultHeartbeatIntervalMs,
  libraryDiscoveryHeartbeatState = createLibraryDiscoveryHeartbeatState(),
  onError = () => {},
  setIntervalFn = setInterval,
  startLibraryDiscoveryRun = async () => ({ accepted: true }),
} = {}) {
  async function runTick() {
    const occurredAt = getNow().toISOString();

    try {
      const heartbeatReadiness = await heartbeatPauseService?.resolveHeartbeatReadiness?.({
        operationLabel: 'Discovery dispatch',
      }) ?? { allowed: true };

      if (!heartbeatReadiness.allowed) {
        libraryDiscoveryHeartbeatState.recordHeartbeatOutcome({
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

      const [activeRun, snapshot] = await Promise.all([
        getActiveRun(),
        getDiscoverySnapshot(),
      ]);
      const now = getNow();

      if (!shouldStartLibraryDiscoveryHeartbeatRun({
        activeRun,
        intervalMs,
        now,
        snapshot,
      })) {
        libraryDiscoveryHeartbeatState.recordHeartbeatOutcome({
          occurredAt,
          outcome: 'skipped',
          skipReason: 'not_due',
        });
        return { reason: 'not_due', skipped: true };
      }

      await startLibraryDiscoveryRun({ triggerSource: 'heartbeat' });
      libraryDiscoveryHeartbeatState.recordHeartbeatOutcome({
        occurredAt,
        outcome: 'started',
      });
      return { skipped: false };
    } catch (error) {
      if (error?.code === 'library_discovery_in_progress') {
        libraryDiscoveryHeartbeatState.recordHeartbeatOutcome({
          occurredAt,
          outcome: 'skipped',
          skipReason: 'run_in_progress',
        });
        return { reason: 'run_in_progress', skipped: true };
      }

      libraryDiscoveryHeartbeatState.recordHeartbeatOutcome({
        errorMessage: error?.message ?? 'Discovery heartbeat failed',
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
      libraryDiscoveryHeartbeatState.recordHeartbeatOutcome({
        occurredAt,
        outcome: 'skipped',
        skipReason: 'tick_in_progress',
      });
      return { reason: 'tick_in_progress', skipped: true };
    },
    setIntervalFn,
  });
}