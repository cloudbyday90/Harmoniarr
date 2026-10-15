/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { mediaTransportPhases } from '../../testing/integration/media-transport-phase-policy.js';
import { createLinuxCanonicalMediaEvidence, resolveLinuxCanonicalMediaEnvironment } from '../../testing/integration/linux-canonical-media-policy.js';
import { preflightLinuxCanonicalMedia } from '../../testing/integration/linux-canonical-media-preflight.js';
import { runLinuxCanonicalMedia } from '../../testing/integration/linux-canonical-media-lane.js';

const image = `sha256:${'a'.repeat(64)}`;
const env = { HARMONIARR_INTEGRATION_MEDIA_IMAGE: image, DOCKER_HOST: 'unix:///var/run/docker.sock' };
const summary = () => ({ type: 'test:summary', data: { success: true,
  counts: { tests: 6, passed: 6, failed: 0, cancelled: 0, skipped: 0, todo: 0, suites: 1 } } });
function records() {
  return [[1, 4], [0, 0], [0, 0], [0, 0], [3, 11], [4, 12]].map(([generations, inspections]) => ({
    mode: 'owned-api', generations, inspections, ownerCleanupSafe: true,
    transport: { version: 2, clipped: false, phases: mediaTransportPhases.map(phase => {
      const count = !inspections || phase === 'reader_context' ? 0
        : ['command_exec', 'command_inspect_before', 'command_inspect_after'].includes(phase) ? inspections : phase === 'start_inspect' ? 2 : 1;
      return { phase, started: count, completed: count, timed: count, failed: 0, pending: 0, untimed: 0 };
    }) },
  }));
}
const stdout = message => ({ type: 'test:stdout', data: { message } });
const events = () => [...records().map(record => stdout(`Library-add media: ${JSON.stringify(record)}\n`)), summary()];
async function* complete() { yield* events(); }
const gate = () => { let release; const promise = new Promise(resolve => { release = resolve; }); return { promise, release }; };

test('Linux lane refuses Windows, mutable images, borrowed PostgreSQL and altered resource/selection policy before preflight', async () => {
  for (const input of [
    { platform: 'win32' }, { nodeVersion: 'v26.0.0' }, { execArgv: ['--eval', 'never execute'] }, { execArgv: ['-pe', 'never execute'] },
    { env: { ...env, HARMONIARR_INTEGRATION_MEDIA_IMAGE: 'mutable:tag' } },
    { env: { ...env, PGPASSWORD: 'borrowed' } }, { env: { ...env, HARMONIARR_TEST_PG_MODE: 'parent' } },
    { env: { ...env, HARMONIARR_INTEGRATION_PG_POOL_MAX: '3' } },
    { env: { ...env, HARMONIARR_LIBRARY_ADD_MEDIA_EXECUTION: 'per-command' } },
  ]) await assert.rejects(runLinuxCanonicalMedia({ env, platform: 'linux', nodeVersion: 'v24.18.1',
    preflight: () => assert.fail('preflight must not start'), ...input }));
  assert.equal(resolveLinuxCanonicalMediaEnvironment({ env, platform: 'linux', nodeVersion: 'v24.18.1' }).HARMONIARR_LIBRARY_ADD_MEDIA_DIAGNOSTICS, 'on');
});

test('fragmented native events require full current inspection/lifecycle work and only emit bounded aggregate evidence', () => {
  const evidence = createLinuxCanonicalMediaEvidence();
  evidence.observe(stdout('private ignored output\n'));
  for (const record of records()) {
    const line = `Library-add media: ${JSON.stringify(record)}\n`;
    for (let index = 0; index < line.length; index += 37) evidence.observe(stdout(line.slice(index, index + 37)));
  }
  evidence.observe(summary());
  assert.deepEqual(evidence.finish(), { tests: 6, skipped: 0, generations: 8, inspections: 27,
    ownersCreated: 3, ownersRemoved: 3, ownerCleanupSafe: true });
});

test('skips, incomplete/duplicate summaries, forged inspection work, unsafe close and oversized evidence cannot pass', () => {
  const mutations = [
    input => { input.at(-1).data.counts.skipped = 1; }, input => { input.pop(); }, input => { input.push(summary()); },
    input => { input.shift(); }, input => { input.unshift({ type: 'test:fail', data: {} }); },
    input => { const record = records()[0]; record.ownerCleanupSafe = false; input[0] = stdout(`Library-add media: ${JSON.stringify(record)}\n`); },
    input => { const record = records()[0]; record.transport.phases.find(row => row.phase === 'command_inspect_after').completed = 0;
      input[0] = stdout(`Library-add media: ${JSON.stringify(record)}\n`); },
    input => { input.unshift(stdout('x'.repeat(16 * 1024 + 1))); },
    input => { input.unshift(stdout('Library-add media: {invalid}\n')); },
  ];
  for (const mutate of mutations) {
    const input = events(); mutate(input); const evidence = createLinuxCanonicalMediaEvidence();
    for (const event of input) { try { evidence.observe(event); } catch { /* A caller cannot clear prior refusal. */ } }
    assert.throws(() => evidence.finish());
  }
});

test('preflight pins CLI/API endpoint, verifies immutable image and closes its reader before admission', async () => {
  let closed = false;
  const result = await preflightLinuxCanonicalMedia({ env, createReader: async ({ setEnvironment }) => {
    setEnvironment({ ...env, DOCKER_API_VERSION: '1.56' }); return { close: async () => { closed = true; } };
  }, executeFileFn: async (binary, args, options) => {
    assert.equal(binary, 'docker'); assert.deepEqual(args, ['image', 'inspect', image]);
    assert.equal(options.env.DOCKER_API_VERSION, '1.56'); assert.equal(options.shell, false);
    return { stdout: JSON.stringify([{ Id: image, Os: 'linux' }]) };
  } });
  assert.equal(closed, true); assert.equal(result.DOCKER_HOST, env.DOCKER_HOST); assert.equal(result.DOCKER_API_VERSION, undefined);
});

test('preflight preserves original null through failed reader disposal and never admits tests', async () => {
  let closed = false;
  await assert.rejects(preflightLinuxCanonicalMedia({ env,
    createReader: async () => ({ close: async () => { closed = true; throw new Error('later close'); } }),
    executeFileFn: async () => { throw null; } }), error => error === null);
  assert.equal(closed, true);
});

test('evidence failure drains held native completion, refuses overlapping environment ownership and restores original values', async () => {
  const before = { ...process.env }; const entered = gate(); const held = gate(); let drained = false;
  const pending = runLinuxCanonicalMedia({ env, platform: 'linux', nodeVersion: 'v24.18.1', preflight: async () => env,
    runTests: ({ files, concurrency, execArgv }) => {
      assert.equal(files.length, 1); assert.ok(files[0].endsWith('missing-music-add-to-library.test.js')); assert.equal(concurrency, 1);
      assert.deepEqual(execArgv, []);
      assert.equal(process.env.HARMONIARR_LIBRARY_ADD_MEDIA_EXECUTION, 'owned-api');
      return (async function* () { yield stdout('Library-add media: {invalid}\n'); entered.release(); await held.promise; drained = true; throw null; })();
    } });
  pending.catch(() => {}); await entered.promise;
  await assert.rejects(runLinuxCanonicalMedia({ env, platform: 'linux', nodeVersion: 'v24.18.1', preflight: async () => env, runTests: complete }), /already owned/u);
  assert.equal(drained, false); held.release(); await assert.rejects(pending, SyntaxError);
  assert.equal(drained, true); assert.deepEqual({ ...process.env }, before);
  const result = await runLinuxCanonicalMedia({ env, platform: 'linux', nodeVersion: 'v24.18.1', preflight: async () => env, runTests: complete });
  assert.equal(result.tests, 6); assert.deepEqual({ ...process.env }, before);
});

for (const primary of [new Error('original native stream'), null]) {
  test(`native stream ${primary === null ? 'null' : 'Error'} remains primary and restores the full environment`, async () => {
    const before = { ...process.env };
    await assert.rejects(runLinuxCanonicalMedia({ env, platform: 'linux', nodeVersion: 'v24.18.1', preflight: async () => env,
      runTests: () => (async function* () { yield { type: 'test:diagnostic', data: {} }; throw primary; })() }), error => error === primary);
    assert.deepEqual({ ...process.env }, before);
  });
}
