/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import test from 'node:test';
import { createPostgresContainerStateProbe, postgresContainerStateFormat }
  from '../../testing/integration/postgres-container-state-probe.js';
import { buildPostgresFailureRecord } from '../../testing/integration/postgres-failure-record.js';

const containerId = 'a'.repeat(64);

test('captured state inspection uses exact argv and numeric/boolean output with short child limits', async () => {
  for (const stdout of ['[true,false,false,false,0,0]', '[false,false,false,true,137,3]']) {
    const result = await createPostgresContainerStateProbe({ containerId, executeFileFn: async (file, args, options) => {
      assert.equal(file, 'docker');
      assert.deepEqual(args, ['container', 'inspect', '--format', postgresContainerStateFormat, containerId]);
      assert.deepEqual(options, { shell: false, windowsHide: true, timeout: 2000, killSignal: 'SIGKILL', maxBuffer: 512 });
      return { stdout };
    } })();
    assert.equal(result.outcome, 'passed');
    const values = JSON.parse(stdout);
    assert.deepEqual([result.running, result.paused, result.restarting, result.oomKilled, result.exitCode, result.restartCount], values);
  }
  assert.throws(() => createPostgresContainerStateProbe({ containerId: 'private;name' }), TypeError);
});

test('malformed, excessive and secret-bearing output cannot enter the serialized failure record', async () => {
  for (const stdout of [undefined, 'private-password', 'x'.repeat(513), '[]', '{}',
    '["private-password",false,false,false,0,0]', '[true,false,false,false,-1,0]',
    '[true,false,false,false,256,0]', '[true,false,false,false,0,-1]',
    '[true,false,false,false,0,1.5]', '[true,false,false,false,0,9007199254740992]',
    '[true,false,false,false,0,0,"private-password"]']) {
    const containerState = await createPostgresContainerStateProbe({ containerId, executeFileFn: async () => ({ stdout }) })();
    assert.equal(containerState.outcome, 'failed');
    const record = buildPostgresFailureRecord({ containerState });
    assert.equal(record.containerState.running, null); assert.equal(record.containerState.restartCount, null);
    assert.equal(JSON.stringify(record).includes('private'), false);
  }
});

test('failed inspect preserves approved categories without copying CLI stdout, stderr or messages', async () => {
  const containerState = await createPostgresContainerStateProbe({ containerId, executeFileFn: async () => {
    throw Object.assign(new Error('private-password'), { code: 'ETIMEDOUT', stdout: 'private-output', stderr: 'private-path' });
  } })();
  assert.equal(containerState.outcome, 'failed');
  const record = buildPostgresFailureRecord({ containerState });
  assert.equal(record.containerState.errors[0].code, 'ETIMEDOUT');
  assert.equal(JSON.stringify(record).includes('private'), false);
});

test('a real bounded child closes before failed state inspection returns', async () => {
  const execute = promisify(execFile); let closed = false;
  const result = await createPostgresContainerStateProbe({ containerId, executeFileFn: (_file, _args, options) => {
    const pending = execute(process.execPath, ['--input-type=module', '-e',
      "process.stdout.write('x'.repeat(1024)); setInterval(() => {}, 1000);"], options);
    pending.child.once('close', () => { closed = true; });
    return pending;
  } })();
  assert.equal(result.outcome, 'failed'); assert.equal(closed, true);
});
