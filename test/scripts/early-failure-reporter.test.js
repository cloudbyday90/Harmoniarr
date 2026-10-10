/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { syncBuiltinESMExports } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  createEarlyFailureRecord,
  earlyFailureMarker,
  formatEarlyFailure,
} from '../../testing/reporters/early-failure-format.js';
import { createEarlyFailureReporter } from '../../testing/reporters/early-failure-reporter.js';

const projectRoot = fileURLToPath(new URL('../..', import.meta.url));
const testFile = fileURLToPath(import.meta.url);
const fixtureFile = fileURLToPath(new URL('../../testing/reporters/fixtures/held-failure.js', import.meta.url));

function failureEvent(error, wrapper = {}) {
  return {
    type: 'test:fail',
    data: {
      file: testFile,
      line: 31,
      column: 1,
      name: 'private-test-name-canary',
      details: { error: { code: 'ERR_TEST_FAILURE', cause: error, ...wrapper } },
    },
  };
}

test('failure presentation retains bounded assertion class and source locations, without error payloads', () => {
  const error = {
    name: 'AssertionError',
    code: 'ERR_ASSERTION',
    message: 'private-message-canary',
    cause: { password: 'private-cause-canary' },
    expected: 'private-expected-canary',
    actual: 'private-actual-canary',
    env: { DATABASE_URL: 'postgres://private-credential-canary@host/database' },
    stdout: 'private-stdout-canary',
    query: 'SELECT private-sql-canary',
    stack: `AssertionError: private-stack-header-canary\n    at private-function-canary (${pathToFileURL(testFile)}:53:9)\n    at ${testFile}:58:2`,
  };
  const event = failureEvent(error);
  const record = createEarlyFailureRecord(event, { projectRoot });
  assert.deepEqual(record, {
    version: 1,
    category: 'assertion',
    code: 'ERR_ASSERTION',
    errorClass: 'AssertionError',
    location: { file: 'test/scripts/early-failure-reporter.test.js', line: 31, column: 1 },
    frames: [
      { file: 'test/scripts/early-failure-reporter.test.js', line: 53, column: 9 },
      { file: 'test/scripts/early-failure-reporter.test.js', line: 58, column: 2 },
    ],
  });
  const rendered = formatEarlyFailure(event, { projectRoot });
  assert.equal(rendered.startsWith(earlyFailureMarker), true);
  assert.equal(rendered.endsWith('\n'), true);
  assert.equal(rendered.includes('private-'), false);
  assert.equal(rendered.includes(projectRoot), false);
});

test('unknown classes and codes cannot become public diagnostic strings', () => {
  const record = createEarlyFailureRecord(failureEvent({
    name: 'private-error-class-canary',
    code: 'private-error-code-canary',
    stack: 'private-error-stack-canary',
  }, { code: 'private-wrapper-code-canary', failureType: 'private-failure-type-canary' }), { projectRoot });
  assert.equal(record.category, 'error');
  assert.equal(record.code, null);
  assert.equal(record.errorClass, null);
  assert.deepEqual(record.frames, []);
  assert.equal(JSON.stringify(record).includes('private-'), false);
});

test('native timeout and cancellation wrappers retain only approved failure categories', () => {
  for (const [failureType, category] of [
    ['testTimeoutFailure', 'timeout'], ['cancelledByParent', 'cancelled'],
    ['hookFailed', 'hook'], ['uncaughtException', 'uncaught'], ['unhandledRejection', 'unhandled'],
  ]) {
    const record = createEarlyFailureRecord(failureEvent(new Error('private-message-canary'), { failureType }), { projectRoot });
    assert.equal(record.category, category);
    assert.equal(record.code, 'ERR_TEST_FAILURE');
    assert.equal(record.errorClass, 'Error');
  }
});

test('known operational failures retain bounded codes without database or provider bodies', () => {
  for (const [code, category] of [
    ['23505', 'database'], ['40001', 'database'], ['ECONNREFUSED', 'connection'],
    ['ETIMEDOUT', 'timeout'], ['ABORT_ERR', 'cancelled'], ['operation_run_lease_lost', 'ownership'],
  ]) {
    const event = failureEvent({ name: 'Error', code, message: 'private-provider-body-canary' });
    assert.equal(createEarlyFailureRecord(event, { projectRoot }).category, category);
    assert.equal(createEarlyFailureRecord(event, { projectRoot }).code, code);
    assert.equal(formatEarlyFailure(event, { projectRoot }).includes('private-'), false);
  }
});

test('outside, nonexistent, non-code and malformed locations are omitted instead of exposing paths', () => {
  const paths = [
    path.resolve(projectRoot, '..', 'private-home-canary.js'),
    path.resolve(`${projectRoot}-neighbor`, 'test', 'private-path-canary.js'),
    path.resolve(projectRoot, 'test/scripts/private-not-a-source-canary.js'),
    path.resolve(projectRoot, 'package.json'),
    `${pathToFileURL(testFile)}?private-query-canary`,
    'test/scripts/early-failure-reporter.test.js',
  ];
  for (const file of paths) {
    const event = failureEvent({ stack: `Error: private-message-canary\n    at ${file}:1:1` });
    event.data.file = file;
    const record = createEarlyFailureRecord(event, { projectRoot });
    assert.equal(record.location, null);
    assert.deepEqual(record.frames, []);
    assert.equal(JSON.stringify(record).includes('private-'), false);
  }
  for (const position of [0, -1, 1.2, Infinity, 1_000_001, '1']) {
    const event = failureEvent({});
    event.data.line = position;
    assert.equal(createEarlyFailureRecord(event, { projectRoot }).location, null);
  }
});

test('outside and UNC source locations are rejected before any filesystem lookup', (t) => {
  const originalRealpath = fs.realpathSync;
  const lookedUp = [];
  let simulateSourceSymlinkEscape = false;
  const outsidePaths = [
    path.resolve(projectRoot, '..', 'private-outside-canary.js'),
    '\\\\private-network-canary\\share\\test\\private-source-canary.js',
  ];
  const realpathSpy = t.mock.method(fs, 'realpathSync', (file, ...args) => {
    lookedUp.push(file);
    if (outsidePaths.includes(file)) throw new Error('private-lookup-canary');
    if (simulateSourceSymlinkEscape && file === testFile) return outsidePaths[0];
    return originalRealpath(file, ...args);
  });
  syncBuiltinESMExports();
  t.after(() => {
    realpathSpy.mock.restore();
    syncBuiltinESMExports();
  });
  for (const file of outsidePaths) {
    const event = failureEvent({ stack: `Error: private-message-canary\n    at ${file}:1:1` });
    event.data.file = file;
    const record = createEarlyFailureRecord(event, { projectRoot });
    assert.equal(record.location, null);
    assert.deepEqual(record.frames, []);
  }
  assert.equal(lookedUp.some((file) => outsidePaths.includes(file)), false);
  simulateSourceSymlinkEscape = true;
  const symlinkEvent = failureEvent({ stack: `Error: private-message-canary\n    at ${testFile}:1:1` });
  const symlinkRecord = createEarlyFailureRecord(symlinkEvent, { projectRoot });
  assert.equal(symlinkRecord.location, null);
  assert.deepEqual(symlinkRecord.frames, []);
  assert.equal(lookedUp.includes(testFile), true);
  assert.equal(lookedUp.some((file) => outsidePaths.includes(file)), false);
});

test('source frames are deduplicated, bounded and do not forward arbitrary function names', () => {
  const stack = `Error: private-header-canary\n${Array.from({ length: 200 }, (_, index) =>
    `    at private-function-canary (${testFile}:${index < 2 ? 1 : index}:1)`).join('\n')}`;
  const record = createEarlyFailureRecord(failureEvent({ stack }), { projectRoot });
  assert.equal(record.frames.length, 5);
  assert.equal(new Set(record.frames.map((frame) => frame.line)).size, 5);
  assert.equal(JSON.stringify(record).includes('private-'), false);
  assert.equal(formatEarlyFailure(failureEvent({ stack }), { projectRoot }).length < 2000, true);
});

test('absent errors, cyclic causes and throwing error accessors cannot prevent bounded diagnosis', () => {
  const error = { name: 'TypeError', code: 'ERR_TEST_FAILURE' };
  error.cause = error;
  Object.defineProperty(error, 'stack', { get() { throw new Error('private-getter-canary'); } });
  assert.deepEqual(createEarlyFailureRecord(failureEvent(error), { projectRoot }).frames, []);
  assert.equal(createEarlyFailureRecord({ type: 'test:fail' }, { projectRoot }).category, 'error');
  const proxy = new Proxy({}, { get() { throw new Error('private-proxy-canary'); } });
  assert.equal(createEarlyFailureRecord(proxy, { projectRoot }), null);
});

test('parent failure wrappers and non-failure output do not create duplicate or raw diagnostics', () => {
  assert.equal(formatEarlyFailure(failureEvent(new Error('private-message-canary'), { failureType: 'subtestsFailed' })), null);
  for (const type of ['test:pass', 'test:stdout', 'test:stderr', 'test:diagnostic', 'test:summary']) {
    assert.equal(formatEarlyFailure({ type, data: { message: 'private-output-canary' } }), null);
  }
});

test('reporter yields a failure before requesting a later blocked event', async () => {
  let requestedLaterEvent = false;
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  async function* events() {
    yield { type: 'test:stdout', data: { message: 'private-output-canary' } };
    yield failureEvent({ name: 'TypeError', message: 'private-message-canary' });
    requestedLaterEvent = true;
    await gate;
    yield { type: 'test:summary', data: {} };
  }
  const reporter = createEarlyFailureReporter({ projectRoot })(events());
  try {
    const first = await reporter.next();
    assert.equal(first.done, false);
    assert.equal(first.value.includes('"errorClass":"TypeError"'), true);
    assert.equal(first.value.includes('private-'), false);
    assert.equal(requestedLaterEvent, false);
  } finally {
    release();
    assert.equal((await reporter.next()).done, true);
  }
});

test('native Node reports approved failure details while a later case remains held, preserving separate TAP and exit status', { timeout: 15_000 }, async (t) => {
  // The owned CLI must start as a runner, rather than inherit this test worker's
  // internal child serialization mode. Other environment values remain unchanged.
  const { NODE_TEST_CONTEXT: _nodeTestContext, ...childEnv } = process.env;
  const child = spawn(process.execPath, [
    '--test', '--test-isolation=none', '--test-concurrency=1',
    '--test-reporter=tap', '--test-reporter=./testing/reporters/early-failure-reporter.js',
    '--test-reporter-destination=stdout', '--test-reporter-destination=stderr', fixtureFile,
  ], { cwd: projectRoot, env: childEnv, stdio: ['ignore', 'pipe', 'pipe', 'ipc'], windowsHide: true });
  let nativeOutput = '';
  let boundedOutput = '';
  let held = false;
  let released = false;
  let closed = false;
  let resolveHeld;
  let resolveDiagnostic;
  const heldReady = new Promise((resolve) => { resolveHeld = resolve; });
  const diagnosticReady = new Promise((resolve) => { resolveDiagnostic = resolve; });
  const childClosed = once(child, 'close').then(([code, signal]) => {
    closed = true;
    return { code, signal };
  });
  child.stdout.on('data', (chunk) => { nativeOutput += chunk.toString(); });
  child.stderr.on('data', (chunk) => {
    boundedOutput += chunk.toString();
    if (boundedOutput.includes('\n')) resolveDiagnostic();
  });
  child.on('message', (message) => {
    if (message?.state === 'held') { held = true; resolveHeld(); }
    if (message?.state === 'released') released = true;
  });
  t.after(async () => {
    if (child.connected && !released) child.send('release');
    const timer = setTimeout(() => { if (!closed) child.kill(); }, 2000);
    try { await childClosed; } finally { clearTimeout(timer); }
  });
  const earlyResult = await Promise.race([
    Promise.all([heldReady, diagnosticReady]).then(() => 'held_failure'),
    childClosed.then(() => 'closed'),
    once(t.signal, 'abort').then(() => 'aborted'),
  ]);
  assert.equal(earlyResult, 'held_failure');
  assert.equal(held, true);
  assert.equal(released, false);
  assert.equal(closed, false);
  assert.equal(nativeOutput.includes('# tests '), false);
  const firstLine = boundedOutput.trim().split('\n')[0];
  assert.equal(firstLine.startsWith(earlyFailureMarker), true);
  const record = JSON.parse(firstLine.slice(earlyFailureMarker.length));
  assert.equal(record.category, 'assertion');
  assert.equal(record.code, 'ERR_ASSERTION');
  assert.equal(record.errorClass, 'AssertionError');
  assert.equal(record.location.file, 'testing/reporters/fixtures/held-failure.js');
  assert.equal(record.frames.some((frame) => frame.file === record.location.file), true);
  assert.equal(boundedOutput.includes('private-'), false);
  assert.equal(boundedOutput.includes(projectRoot), false);
  child.send('release');
  const result = await childClosed;
  assert.deepEqual(result, { code: 1, signal: null });
  assert.equal(released, true);
  assert.equal(nativeOutput.includes('# tests 2'), true);
  assert.equal(nativeOutput.includes('private-message-canary'), true);
  assert.equal(boundedOutput.trim().split('\n').length, 1);
});

test('default isolated Node worker emits approved failure before its held HTTP case completes', { timeout: 15_000 }, async (t) => {
  let releaseResponse;
  let resolveHeld;
  let responseReleased = false;
  let child = null;
  let childClosed = null;
  let closed = false;
  const heldReady = new Promise((resolve) => { resolveHeld = resolve; });
  const server = createServer((request, response) => {
    if (request.method !== 'GET' || request.url !== '/release') {
      response.writeHead(404).end();
      return;
    }
    releaseResponse = response;
    resolveHeld();
  });
  t.after(async () => {
    releaseHeldCase();
    const timer = setTimeout(() => { if (child && !closed) child.kill(); }, 2000);
    try {
      if (childClosed) await childClosed;
    } finally {
      clearTimeout(timer);
      server.closeAllConnections();
      await new Promise((resolve) => { server.close(resolve); });
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { NODE_TEST_CONTEXT: _nodeTestContext, ...childEnv } = process.env;
  childEnv.HARMONIARR_REPORTER_RELEASE_URL = `http://127.0.0.1:${server.address().port}/release`;
  const isolatedFixture = fileURLToPath(new URL('../../testing/reporters/fixtures/held-http-failure.js', import.meta.url));
  child = spawn(process.execPath, [
    '--test', '--test-concurrency=1',
    '--test-reporter=tap', '--test-reporter=./testing/reporters/early-failure-reporter.js',
    '--test-reporter-destination=stdout', '--test-reporter-destination=stderr', isolatedFixture,
  ], { cwd: projectRoot, env: childEnv, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let nativeOutput = '';
  let boundedOutput = '';
  let resolveDiagnostic;
  const diagnosticReady = new Promise((resolve) => { resolveDiagnostic = resolve; });
  childClosed = once(child, 'close').then(([code, signal]) => {
    closed = true;
    return { code, signal };
  });
  child.stdout.on('data', (chunk) => { nativeOutput += chunk.toString(); });
  child.stderr.on('data', (chunk) => {
    boundedOutput += chunk.toString();
    if (boundedOutput.includes('\n')) resolveDiagnostic();
  });
  function releaseHeldCase() {
    if (releaseResponse && !releaseResponse.writableEnded) {
      responseReleased = true;
      releaseResponse.writeHead(200, { 'content-type': 'text/plain' }).end('released');
    }
  }
  const earlyResult = await Promise.race([
    Promise.all([heldReady, diagnosticReady]).then(() => 'held_failure'),
    childClosed.then(() => 'closed'),
    once(t.signal, 'abort').then(() => 'aborted'),
  ]);
  assert.equal(earlyResult, 'held_failure');
  assert.equal(responseReleased, false);
  assert.equal(releaseResponse.writableEnded, false);
  assert.equal(closed, false);
  assert.equal(nativeOutput.includes('# tests '), false);
  const firstLine = boundedOutput.trim().split('\n')[0];
  assert.equal(firstLine.startsWith(earlyFailureMarker), true);
  const record = JSON.parse(firstLine.slice(earlyFailureMarker.length));
  assert.equal(record.category, 'assertion');
  assert.equal(record.code, 'ERR_ASSERTION');
  assert.equal(record.errorClass, 'AssertionError');
  assert.equal(record.location.file, 'testing/reporters/fixtures/held-http-failure.js');
  assert.equal(record.frames.some((frame) => frame.file === record.location.file), true);
  assert.equal(boundedOutput.includes('private-'), false);
  assert.equal(boundedOutput.includes(projectRoot), false);
  releaseHeldCase();
  assert.deepEqual(await childClosed, { code: 1, signal: null });
  assert.equal(nativeOutput.includes('# tests 2'), true);
  assert.equal(nativeOutput.includes('private-message-canary'), true);
  assert.equal(boundedOutput.trim().split('\n').length, 1);
});
