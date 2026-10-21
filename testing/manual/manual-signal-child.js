/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */

import assert from 'node:assert/strict';
import { runManualMetadataHistory } from './manual-session-runner.js';

// Private native-test worker: IPC gates control only the injected session.
const [phase, failure] = process.argv.slice(2);
assert.ok(process.send && ['startup', 'ready'].includes(phase));
assert.ok(['none', 'error', 'null'].includes(failure));
const cleanup = Promise.withResolvers();
const cleanupError = failure === 'null' ? null : new Error('controlled cleanup failure');
let commands = 0; let stopped = false;
process.on('message', message => {
  if (message === 'release') cleanup.resolve();
  if (message === 'probe') process.send({ type: 'probe', commands, stopped });
});
try {
  await runManualMetadataHistory({ async runSession(run, { signal }) {
    signal.addEventListener('abort', () => { stopped = true; }, { once: true });
    let cancelled = false;
    try {
      if (phase === 'startup') {
        process.send({ type: 'checkpoint', platform: process.platform, node: process.versions.node });
        await new Promise((_, reject) => { signal.addEventListener('abort', () => reject(signal.reason), { once: true }); });
      } else {
        const pending = run({ baseUrl: 'http://127.0.0.1:1', artistUrl: 'http://127.0.0.1:1/artist',
          controller: { command() { commands++; return { accepted: true }; } } });
        process.send({ type: 'checkpoint', platform: process.platform, node: process.versions.node });
        await pending;
      }
    } catch (error) {
      assert.equal(error, signal.reason); cancelled = true;
    }
    process.send({ type: 'cleanup', stopped, commands });
    await cleanup.promise;
    if (failure !== 'none') throw cleanupError;
    if (cancelled) throw signal.reason;
  } });
} catch (error) {
  // Preserve identity, including null, without publishing arbitrary diagnostics.
  process.send({ type: 'failure', same: failure !== 'none' && error === cleanupError });
  process.exitCode = 1;
} finally {
  process.disconnect();
}
