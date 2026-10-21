/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Writable } from 'node:stream';
import { spawn } from 'node:child_process';
import test from 'node:test';
import { writeCliRecord } from '../../src/server/cli/cli-output.js';
import { writeAndExit } from '../../src/server/cli/cli-runtime.js';
import { armCommand, cancelCommand, statusCommand } from '../../src/server/cli/recovery-commands.js';

const settled = promise => promise.then(value => ({ ok: true, value }), error => ({ ok: false, error }));
const tick = () => new Promise(resolve => { setImmediate(resolve); });
const armed = { status: 'armed', recoveryCode: 'fixture-only-secret', expiresAt: '2026-10-21T23:59:59Z', replacedExistingRun: false };

test('one-record output waits for its actual write callback under backpressure without ending a borrowed stream', async () => {
  let complete;
  const stream = new Writable({ highWaterMark: 1, write(_chunk, _encoding, callback) { complete = callback; } });
  let done = false;
  const pending = writeCliRecord(stream, 'fixture\n').then(() => { done = true; });
  try {
    await tick();
    assert.equal(stream.writableNeedDrain, true);
    assert.equal(done, false);
  } finally { complete(); }
  await pending;
  assert.equal(stream.writableEnded, false);
  assert.equal(stream.listenerCount('error'), 0);
  assert.equal(stream.listenerCount('close'), 0);
  stream.destroy();
});

test('write callback failure retains the error listener through native emission and preserves unrelated listeners', async () => {
  const failure = new Error('private output failure');
  const foreign = () => {};
  const stream = new Writable({ write(_chunk, _encoding, callback) { callback(failure); } });
  stream.on('error', foreign);
  const result = await settled(writeCliRecord(stream, 'fixture\n'));
  assert.equal(result.ok, false);
  assert.equal(result.error, failure);
  await tick();
  assert.deepEqual(stream.listeners('error'), [foreign]);
  assert.equal(stream.listenerCount('close'), 0);
});

test('synchronous null write failure is retained; no listener or retry remains', async () => {
  const stream = new EventEmitter(); let writes = 0;
  stream.write = () => { writes++; throw null; };
  const result = await settled(writeCliRecord(stream, 'fixture'));
  assert.equal(result.ok, false); assert.equal(result.error, null);
  await tick(); assert.equal(writes, 1); assert.equal(stream.listenerCount('error'), 0);
});

test('premature output close and an already destroyed destination refuse delivery', async () => {
  const stream = new Writable({ write() {} });
  const pending = settled(writeCliRecord(stream, 'fixture'));
  stream.destroy();
  const result = await pending;
  assert.equal(result.ok, false); assert.equal(result.error.code, 'ERR_STREAM_PREMATURE_CLOSE');
  const again = await settled(writeCliRecord(stream, 'fixture'));
  assert.equal(again.ok, false); assert.equal(again.error.code, 'ERR_STREAM_PREMATURE_CLOSE');
  await tick(); assert.equal(stream.listenerCount('error'), 0);
});

test('exit status is published after successful handoff, and failure sets a nonzero status', async () => {
  const codes = []; let complete;
  const stream = new Writable({ write(_chunk, _encoding, callback) { complete = callback; } });
  const pending = writeAndExit({ stdout: stream, textOutput: 'fixture', exitCode: 3, setExitCode: code => codes.push(code) });
  assert.deepEqual(codes, []); complete(); await pending; assert.deepEqual(codes, [3]); stream.destroy();
  const broken = new Writable({ write(_chunk, _encoding, callback) { callback(new Error('private')); } });
  const refused = await settled(writeAndExit({ stdout: broken, textOutput: 'fixture', setExitCode: code => codes.push(code) }));
  assert.equal(refused.ok, false); assert.deepEqual(codes, [3, 1]); await tick();
});

test('committed material is awaited once before pool cleanup; cleanup failure preserves the delivered result', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const calls = []; const records = []; const failure = new Error('private cleanup credentials');
  const pending = armCommand({ args: ['--json'],
    recoveryService: { async armBootstrapAdminRecovery() { calls.push('arm'); return armed; } },
    writeOutput: async record => { records.push(record); if (record.jsonOutput) { calls.push('write'); await gate; calls.push('delivered'); } },
    cleanup: async () => { calls.push('cleanup'); throw failure; },
  });
  try { await tick(); assert.deepEqual(calls, ['arm', 'write']); }
  finally { release(); }
  const result = await pending;
  assert.deepEqual(calls, ['arm', 'write', 'delivered', 'cleanup']);
  assert.equal(result.operationSucceeded, true); assert.equal(result.outputDelivered, true); assert.equal(result.exitCode, 1);
  assert.equal(result.failures[0].error, failure); assert.equal(result.failures[0].stage, 'cleanup');
  assert.equal(JSON.parse(records[0].jsonOutput).recoveryCode === armed.recoveryCode, true);
  assert.equal(records.length, 2); assert.equal(records[1].textError.includes(armed.recoveryCode), false);
  assert.equal(records[1].textError.includes(failure.message), false);
});

test('failed code handoff never re-executes or repeats stdout; secondary failures retain original Error/null', async () => {
  for (const failure of [new Error('private output credentials'), null]) {
    let executions = 0; let cleanupCalls = 0; const records = [];
    const cleanupFailure = new Error('cleanup');
    const result = await armCommand({ args: ['--json'],
      recoveryService: { async armBootstrapAdminRecovery() { executions++; return armed; } },
      writeOutput: async record => { records.push(record); throw failure; },
      cleanup: async () => { cleanupCalls++; throw cleanupFailure; },
    });
    assert.equal(executions, 1); assert.equal(cleanupCalls, 1); assert.equal(result.exitCode, 1);
    assert.equal(result.operationSucceeded, true); assert.equal(result.outputDelivered, false);
    assert.deepEqual(result.failures.map(({ stage }) => stage), ['output', 'cleanup', 'diagnostic']);
    assert.equal(result.failures[0].error, failure); assert.equal(result.failures[1].error, cleanupFailure);
    assert.equal(records.filter(record => record.jsonOutput).length, 1);
    assert.equal(records[1].textError.includes(armed.recoveryCode), false);
    assert.match(records[1].textError, /completed.*delivery failed/iu);
  }
});

test('primary service Error/null survives cleanup and delivery failures without raw error disclosure', async () => {
  for (const command of [armCommand, cancelCommand, statusCommand]) {
    for (const failure of [new Error('private database/password/code'), null]) {
      let cleanupCalls = 0; const records = [];
      const service = new Proxy({}, { get: () => async () => { throw failure; } });
      const result = await command({ args: ['--json'], recoveryService: service,
        writeOutput: async record => { records.push(record); throw new Error('output'); },
        cleanup: async () => { cleanupCalls++; throw new Error('cleanup'); },
      });
      assert.equal(result.failures[0].error, failure); assert.equal(result.failures[0].stage, 'operation');
      assert.equal(result.operationSucceeded, false); assert.equal(result.exitCode, 1); assert.equal(cleanupCalls, 1);
      assert.equal(JSON.parse(records[0].jsonOutput).error.code, 'RECOVERY_INTERNAL_ERROR');
      assert.equal(JSON.stringify(records).includes('private database'), false);
    }
  }
});

test('expected refusals retain stable exit codes through cleanup failure and discard private message text', async () => {
  const records = []; const primary = Object.assign(new Error('private details'), { code: 'RECOVERY_ALREADY_ARMED' });
  const result = await armCommand({ args: ['--json'], recoveryService: { async armBootstrapAdminRecovery() { throw primary; } },
    writeOutput: async record => records.push(record), cleanup: async () => { throw null; },
  });
  assert.equal(result.exitCode, 3); assert.equal(result.failures[0].error, primary); assert.equal(result.failures[1].error, null);
  assert.equal(JSON.stringify(records).includes('private details'), false);
  assert.equal(JSON.parse(records[0].jsonOutput).error.code, 'RECOVERY_ALREADY_ARMED');
});

test('invalid options refuse before service work, clean up once and do not echo supplied secrets', async () => {
  for (const args of [['--private-secret', '--json'], ['--ttl-minutes', '10junk', '--json'], ['--ttl-minutes', '999999999999999999999', '--json'], ['private-secret', '--json']]) {
    let calls = 0; let cleanupCalls = 0; const records = [];
    const result = await armCommand({ args, recoveryService: { async armBootstrapAdminRecovery() { calls++; } },
      writeOutput: async record => records.push(record), cleanup: async () => { cleanupCalls++; },
    });
    assert.equal(result.exitCode, 2); assert.equal(calls, 0); assert.equal(cleanupCalls, 1);
    assert.equal(JSON.parse(records[0].jsonOutput).error.code, 'RECOVERY_INVALID_ARGUMENT');
    assert.equal(JSON.stringify(records).includes('private-secret'), false);
  }
});

test('status projects approved fields even if a service gains private recovery fields', async () => {
  const records = [];
  await statusCommand({ args: ['--json'], cleanup: async () => {}, writeOutput: async record => records.push(record),
    recoveryService: { async getBootstrapAdminRecoveryStatus() { return { recoveryAvailable: true, recoveryCode: armed.recoveryCode, recoveryCodeHash: 'private-hash' }; } },
  });
  assert.equal(JSON.stringify(records).includes(armed.recoveryCode), false);
  assert.equal(JSON.stringify(records).includes('private-hash'), false);
});

async function runChild(t, source, { args = [], closedOutput = false } = {}) {
  const child = spawn(process.execPath, source ? ['--input-type=module', '-e', source] : ['src/server/cli/harmoniarrctl.js', ...args], {
    windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], signal: t.signal,
  });
  let spawnError;
  child.on('error', error => { spawnError = error; });
  const closed = new Promise(resolve => { child.once('close', (code, signal) => resolve([code, signal])); });
  const stdout = []; const stderr = [];
  if (closedOutput) child.stdout.destroy();
  else child.stdout.on('data', chunk => stdout.push(chunk));
  child.stderr.on('data', chunk => stderr.push(chunk));
  const [code, signal] = await closed;
  if (spawnError) throw spawnError;
  return { code, signal, stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr).toString() };
}

test('native child stdout and stderr pipes deliver complete records and actual exit status', { timeout: 10000 }, async t => {
  for (const destination of ['textOutput', 'textError']) {
    const size = 2 * 1024 * 1024;
    const result = await runChild(t, `import {writeAndExit} from './src/server/cli/cli-runtime.js';await writeAndExit({${destination}:'x'.repeat(${size}),exitCode:3});`);
    assert.equal(result.code, 3); assert.equal(result.signal, null);
    const output = destination === 'textOutput' ? result.stdout : Buffer.from(result.stderr);
    assert.equal(output.length, size + 1);
    assert.equal(output.subarray(0, size).every(byte => byte === 120), true);
    assert.equal(output.at(-1), 10);
  }
});

test('native broken output destination fails without an uncaught stack or secret replay', { timeout: 10000 }, async t => {
  const source = `import {armCommand} from './src/server/cli/recovery-commands.js';
    const outcome=await armCommand({args:['--json'],cleanup:async()=>{},recoveryService:{async armBootstrapAdminRecovery(){return {status:'armed',recoveryCode:'x'.repeat(2097152)};}}});process.exitCode=outcome.exitCode;`;
  const result = await runChild(t, source, { closedOutput: true });
  assert.equal(result.code, 1); assert.equal(result.signal, null);
  assert.match(result.stderr, /completed.*delivery failed/iu);
  assert.equal(result.stderr.includes('xxxx'), false); assert.equal(result.stderr.includes('Error:'), false);
});

test('native entrypoint handles usage and prototype names without database work or raw argument echo', { timeout: 10000 }, async t => {
  const help = await runChild(t, null, { args: ['--help'] });
  assert.equal(help.code, 0); assert.match(help.stdout.toString(), /Usage: harmoniarrctl/u); assert.equal(help.stderr, '');
  for (const args of [['__proto__', 'private-secret'], ['recovery', 'toString'], ['recovery', 'arm-bootstrap-admin', '--private-secret', '--json']]) {
    const result = await runChild(t, null, { args });
    assert.equal(result.code, 2); assert.equal(result.signal, null);
    assert.equal(result.stderr.includes('private-secret'), false); assert.equal(result.stderr.includes('TypeError'), false);
  }
});
