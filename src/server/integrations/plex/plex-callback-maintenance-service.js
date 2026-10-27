/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { createIntervalHeartbeatRunner } from '../../heartbeat/interval-heartbeat-runner.js';
import { createPlexCallbackRetentionService } from './plex-callback-retention-service.js';
import { plexCallbackRetentionIntervalMs } from './plex-callback-retention-policy.js';

/** One pass per tick; admission remains closed through actual transaction retirement. */
export function createPlexCallbackMaintenanceService({ retentionService = createPlexCallbackRetentionService(),
  createRunnerFn = createIntervalHeartbeatRunner, intervalMs = plexCallbackRetentionIntervalMs } = {}) {
  if (!Number.isSafeInteger(intervalMs) || intervalMs < 1 || intervalMs > 2_147_483_647) throw new TypeError('A bounded callback maintenance interval is required');
  let closed = false, sealed = false, active = null, closing, onWarning = () => {};
  async function run() {
    let task;
    try { task = retentionService.startPrune(); return await task.result; }
    catch { onWarning('Plex callback maintenance is temporarily unavailable'); return { skipped: true, reason: 'unavailable' }; }
    finally {
      if (task) {
        try { if (await task.drained !== true) sealed = true; } catch { sealed = true; }
      }
    }
  }
  const runner = createRunnerFn({ intervalMs, onTick: () => {
    if (closed || sealed) return { skipped: true, reason: 'closed' };
    active = run().finally(() => { active = null; }); return active;
  } });
  function stopAndDrain() {
    if (closing) return closing;
    closed = true; runner.stop();
    closing = Promise.resolve(active).then(() => { if (sealed) throw new Error('Plex callback maintenance retirement is uncertain'); });
    return closing;
  }
  return { tick: runner.tick, start: () => { if (!closed) return runner.start(); }, stop: runner.stop, stopAndDrain, close: stopAndDrain,
    setLogHandlers: handlers => { onWarning = handlers.onWarning ?? onWarning; } };
}
