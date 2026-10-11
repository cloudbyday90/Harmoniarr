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

import { createIntervalHeartbeatRunner } from './interval-heartbeat-runner.js';
import { normalizeExpectedJobLease } from '../job-lease-policy.js';
import { createWorkerTaskLifecycle } from '../worker-task-lifecycle.js';

const defaultHeartbeatIntervalMs = 60 * 1000;

export function createOperationRunLeaseHeartbeat({
  createIntervalHeartbeatRunnerFn = createIntervalHeartbeatRunner,
  intervalMs = defaultHeartbeatIntervalMs,
  onError = () => {},
  renewLease,
  expectedLease,
  runId,
  status = 'active',
} = {}) {
  const capturedLease = normalizeExpectedJobLease(expectedLease);
  let sequence = 0;
  let stopping;
  const tasks = createWorkerTaskLifecycle({
    execute: async () => {
      try {
        if (!capturedLease) return { reason: 'lease_lost', skipped: true };
        const renewed = await renewLease({ runId, status, expectedLease: capturedLease });
        if (renewed === null) return { reason: 'lease_lost', skipped: true };
        return { skipped: false };
      } catch (error) {
        await onError(error);
        return { reason: 'error', skipped: true };
      }
    },
  });
  const runner = createIntervalHeartbeatRunnerFn({
    intervalMs,
    onTick: () => stopping
      ? Promise.resolve({ reason: 'stopped', skipped: true })
      : tasks.start({ runId: ++sequence }).catch(() => ({ reason: 'error', skipped: true })),
  });

  function stopAndDrain() {
    if (stopping) return stopping;
    const completion = Promise.withResolvers();
    stopping = completion.promise;
    const draining = tasks.close();
    let stopFailed = false;
    let stopFailure;
    try { runner.stop(); }
    catch (error) { stopFailed = true; stopFailure = error; }
    draining.then(() => {
      if (stopFailed) completion.reject(stopFailure);
      else completion.resolve();
    }, completion.reject);
    return stopping;
  }

  return {
    ...runner,
    start() {
      if (stopping) {
        throw Object.assign(new Error('Lease heartbeat admission is closed'), { code: 'heartbeat_closing' });
      }
      return runner.start();
    },
    tick() {
      if (stopping) return Promise.resolve({ reason: 'stopped', skipped: true });
      return runner.tick();
    },
    stopAndDrain,
  };
}
