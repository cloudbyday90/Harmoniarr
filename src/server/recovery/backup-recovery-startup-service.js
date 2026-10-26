/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { createWorkerTaskLifecycle } from '../worker-task-lifecycle.js';

/** One bounded admission task per application boot; shutdown observes actual completion. */
export function createBackupRecoveryStartupService({ queueStartupRecovery, onError = () => { }, delayFn = milliseconds => new Promise(resolve => { setTimeout(resolve, milliseconds); }) } = {}) {
  let started = false, closing = false, state = 'not_started';
  const tasks = createWorkerTaskLifecycle({
    execute: async () => {
      for (let attempt = 0;attempt < 3 && !closing;attempt++) {
        state = 'queuing';
        try { await queueStartupRecovery(); state = 'queued'; return; }
        catch { if (attempt < 2 && !closing) await delayFn(1000); }
      }
      if (!closing) { state = 'failed'; try { onError(new Error('Startup backup recovery could not be queued')); } catch {/* Keep status observable. */ } }
    }
  });
  const start = () => { if (started || closing) return; started = true; void tasks.start({ runId: 'startup' }); };
  const stopAndDrain = () => { closing = true; return tasks.close(); };
  return { start, stop: stopAndDrain, stopAndDrain, getState: () => state };
}
