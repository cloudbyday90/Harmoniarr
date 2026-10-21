/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import test from 'node:test';
import { createRecoveryDockerCommand } from '../../scripts/postgres-recovery-command.js';
import { createManualPostgresRuntime } from '../../testing/manual/manual-postgres-runtime.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { createFixtureGate, waitForFixtureReady, withFixtureLifecycle } from '../../testing/integration/fixture-lifecycle.js';

const config = resolveIntegrationTestRuntimeConfig();
test('actual CLI quit and EOF received during startup never publish readiness and exit after cleanup', { timeout: config.suiteSetupTimeoutMs }, async t => {
  for (const mode of ['quit', 'eof']) {
    await withFixtureLifecycle({ signal: t.signal }, async scope => {
      const child = spawn(process.execPath, [resolve('scripts/run-manual-metadata-history.js')], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
      let output = ''; let diagnostics = '';
      child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
      child.stdout.on('data', value => { output += value; }); child.stderr.on('data', value => { diagnostics += value; });
      const closed = new Promise((accept, reject) => {
        child.once('error', reject); child.once('close', (code, signal) => accept({ code, signal }));
      });
      scope.onRelease(() => child.stdin.end()); scope.track(closed);
      if (mode === 'quit') child.stdin.write('quit\nhold\n'); else child.stdin.end();
      assert.deepEqual(await closed, { code: 0, signal: null }, diagnostics);
      assert.equal(output.includes('Manual history fixture:'), false, mode);
      assert.ok(output.includes('Manual history fixture retired. No manual accessibility pass is inferred.'), mode);
    });
  }
});

test('native database stop drains a held Docker run result and removes only its acknowledged container', { timeout: config.suiteSetupTimeoutMs }, async t => {
  await withFixtureLifecycle({ signal: t.signal }, async scope => {
    const runDocker = createRecoveryDockerCommand(); const started = createFixtureGate(); const hold = createFixtureGate();
    const control = new AbortController(); const reason = new Error('controlled native stop'); let id;
    scope.onRelease(() => { control.abort(reason); hold.release(); });
    const pending = createManualPostgresRuntime({ config, signal: control.signal }, {
      async runDocker(args, options) {
        const result = await runDocker(args, options);
        if (args[0] === 'run') { id = result.stdout.trim(); started.release(); await hold.promise; }
        return result;
      },
    });
    const outcome = (async () => {
      let rejected = false;
      try { await pending; } catch (error) { rejected = true; assert.equal(error, reason); }
      assert.equal(rejected, true);
    })();
    scope.track(outcome);
    await waitForFixtureReady({ ready: started.promise, operation: pending });
    assert.match(id, /^[a-f0-9]{64}$/u); control.abort(reason);
    assert.ok((await runDocker(['container', 'ls', '--all', '--filter', `id=${id}`, '--format', '{{.ID}}'])).stdout.trim());
    hold.release(); await outcome;
    assert.equal((await runDocker(['container', 'ls', '--all', '--filter', `id=${id}`, '--format', '{{.ID}}'])).stdout.trim(), '');
  });
});
