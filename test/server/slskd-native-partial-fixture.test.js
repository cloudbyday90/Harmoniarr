/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createConnection } from 'node:net';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openOwnedTcpServer } from '../../testing/slskd/owned-tcp-server.js';
import { nativePartialPlans } from '../../testing/slskd/native-partial-plan.js';
import { nativeFileChunk, nativeFileDigest } from '../../testing/slskd/native-file-data.js';
import { sendNativePartial } from '../../testing/slskd/native-partial-sender.js';
import { waitForNativePartial } from '../../testing/slskd/native-partial-checkpoint.js';
import { inspectNativePartial } from '../../testing/slskd/native-partial-inspection.js';
import { nativePeer } from '../../testing/slskd/fixture-data.js';
import { acknowledgeNativeFileVolume, nativeFileVolumeOptions } from '../../testing/slskd/native-file-volume.js';
import { runNativePartialScenario } from '../../testing/slskd/native-partial-runner.js';

function prefix(file, length) {
  const chunks = [];
  for (let offset = 0; offset < length; offset += 16_384) chunks.push(nativeFileChunk(file, offset, Math.min(16_384, length - offset)));
  return Buffer.concat(chunks);
}

test('actual FIN and reset sockets expose only their declared prefix and retire after send completion', { timeout: 5000 }, async t => {
  for (const plan of nativePartialPlans.slice(1)) {
    const received = []; const errors = []; let ended = false;
    const ready = Promise.withResolvers(); const sent = Promise.withResolvers(); let work; let client; let closed;
    const server = await openOwnedTcpServer({ onSocket(socket) {
      work = sendNativePartial(socket, plan, { beforeReset: async () => { await ready.promise; return plan.bytes; } });
      work.then(sent.resolve, sent.reject);
    } });
    t.after(async () => { ready.resolve(); client?.destroy(); if (closed) await closed; await server.close(); await Promise.allSettled(work ? [work] : []); });
    client = createConnection({ host: '127.0.0.1', port: server.port });
    closed = new Promise(resolve => { client.once('close', resolve); });
    client.on('error', error => errors.push(error.code)); client.on('end', () => { ended = true; });
    client.on('data', bytes => {
      received.push(bytes);
      if (received.reduce((sum, value) => sum + value.length, 0) >= plan.bytes) ready.resolve();
    });
    await once(client, 'connect', { signal: t.signal });
    const report = await sent.promise; await closed;
    const bytes = Buffer.concat(received);
    assert.equal(bytes.length, plan.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), nativeFileDigest(plan.file, bytes.length));
    assert.equal(report.emittedBytes, plan.bytes);
    if (plan.kind === 'eof') { assert.equal(ended, true); assert.deepEqual(errors, []); }
    else { assert.ok(errors.includes('ECONNRESET')); assert.equal(report.checkpointBytes, plan.bytes); }
  }
});

for (const reason of [new Error('Original checkpoint cancellation'), null]) {
  test('checkpoint drains admitted stat before preserving cancellation ' + (reason === null ? 'null' : 'Error'), async () => {
    const controller = new AbortController(); const entered = Promise.withResolvers(); const held = Promise.withResolvers();
    let calls = 0; let settled = false;
    const read = waitForNativePartial(nativePartialPlans[2].file, { signal: controller.signal,
      statFn: async () => { calls += 1; entered.resolve(); return held.promise; } });
    read.then(() => { settled = true; }, () => { settled = true; });
    await entered.promise; controller.abort(reason);
    assert.equal(settled, false); assert.equal(calls, 1);
    held.resolve({ isFile: () => true, size: 16_384 });
    await assert.rejects(read, error => error === reason);
    assert.equal(calls, 1);
  });
}

test('pre-aborted checkpoints and unowned plans refuse before filesystem or transport work', async () => {
  const controller = new AbortController(); const reason = new Error('Already stopped'); controller.abort(reason);
  let reads = 0;
  await assert.rejects(waitForNativePartial(nativePartialPlans[2].file, { signal: controller.signal,
    statFn: async () => { reads += 1; } }), error => error === reason);
  assert.equal(reads, 0);
  await assert.rejects(waitForNativePartial(nativePartialPlans[0].file), TypeError);
  await assert.rejects(sendNativePartial({}, { ...nativePartialPlans[2] }), TypeError);
  await assert.rejects(sendNativePartial({}, nativePartialPlans[2]), TypeError);
});

test('partial inspection hashes the retained prefix and refuses changed, full, empty or unowned payloads', async t => {
  const root = await mkdtemp(join(tmpdir(), 'harmoniarr-native-partial-unit-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, nativePeer, 'NativeBytes'), { recursive: true });
  for (const plan of nativePartialPlans.slice(1)) {
    const path = join(root, nativePeer, ...plan.file.filename.split('\\'));
    const bytes = prefix(plan.file, plan.bytes); await writeFile(path, bytes);
    const proof = await inspectNativePartial(root, plan);
    assert.equal(proof.size, plan.bytes); assert.equal(proof.sha256, nativeFileDigest(plan.file, plan.bytes));
    bytes[0] ^= 255; await writeFile(path, bytes);
    await assert.rejects(inspectNativePartial(root, plan), { code: 'ERR_ASSERTION' });
    await writeFile(path, prefix(plan.file, plan.file.size));
    await assert.rejects(inspectNativePartial(root, plan), { code: 'ERR_ASSERTION' });
    await writeFile(path, Buffer.alloc(0));
    await assert.rejects(inspectNativePartial(root, plan), { code: 'ERR_ASSERTION' });
  }
  await assert.rejects(inspectNativePartial(root, nativePartialPlans[0]), TypeError);
});

test('both partial-mode volumes require their own bounded identity and read-only inspector mount', async () => {
  const specs = [{ key: 'completed', writer: '/data/downloads', reader: '/downloads' },
    { key: 'incomplete', writer: '/data/incomplete', reader: '/incomplete' }];
  const provider = { Mounts: specs.map(spec => ({ Type: 'volume', Destination: spec.writer, Name: 'owned_' + spec.key, RW: true })) };
  const fixture = { Mounts: specs.map(spec => ({ Type: 'volume', Destination: spec.reader, Name: 'owned_' + spec.key, RW: false })) };
  const inspectVolume = async name => ({ Name: name, Driver: 'local', Options: nativeFileVolumeOptions,
    Labels: { 'com.docker.compose.project': 'owned', 'com.docker.compose.volume': name.slice('owned_'.length) } });
  const verify = f => acknowledgeNativeFileVolume({ provider, fixture: f, projectName: 'owned', mode: 'partial', inspectVolume });
  assert.equal((await verify(fixture)).incompleteBytesLimit, 4194304);
  const wider = structuredClone(fixture); wider.Mounts[1].RW = true; await assert.rejects(verify(wider));
  const wrong = structuredClone(fixture); wrong.Mounts[1].Name = 'other_incomplete'; await assert.rejects(verify(wrong));
  await assert.rejects(verify({ Mounts: [fixture.Mounts[0]] }));
});

test('final file inspection waits for acknowledged provider stop and refuses a still-running producer', async () => {
  const providerId = 'owned-provider'; const entered = Promise.withResolvers(); const stopped = Promise.withResolvers();
  let inspectedFiles = 0;
  const scenario = { complete: true, scenarios: [{ filename: 'owned', bytesTransferred: 1 }] };
  const docker = async args => {
    if (args[0] === 'stop') { entered.resolve(); await stopped.promise; return ''; }
    if (args[0] === 'inspect') return JSON.stringify([{ Id: providerId, State: { Running: false, ExitCode: 0 } }]);
    if (args.at(-1) === 'run') return JSON.stringify(scenario);
    assert.equal(args.at(-1), 'inspect'); inspectedFiles += 1;
    return JSON.stringify({ incomplete: [{ filename: 'owned', size: 1 }] });
  };
  const run = runNativePartialScenario({ docker, fixtureId: 'owned-fixture', providerId });
  await entered.promise; assert.equal(inspectedFiles, 0); stopped.resolve();
  assert.equal((await run).providerStoppedBeforeInspection, true); assert.equal(inspectedFiles, 1);
  await assert.rejects(runNativePartialScenario({ fixtureId: 'owned-fixture', providerId, docker: async args => {
    if (args[0] === 'inspect') return JSON.stringify([{ Id: providerId, State: { Running: true, ExitCode: 0 } }]);
    if (args[0] === 'stop') return '';
    assert.equal(args.at(-1), 'run'); return JSON.stringify(scenario);
  } }), { code: 'ERR_ASSERTION' });
});
