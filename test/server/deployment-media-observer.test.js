/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { createDeploymentMediaObserver } from '../../testing/server/deployment-media-observer.js';

function fixture() {
  const children = []; const launches = []; const controller = new AbortController();
  const observer = createDeploymentMediaObserver({ signal: controller.signal, spawnFn: (...args) => {
    launches.push(args); const child = new EventEmitter(); child.pid = 2_000_000_000 + children.length; children.push(child); return child;
  } });
  const launch = kind => observer.spawnMedia(kind, kind === 'encode' ? 'ffmpeg' : 'ffprobe', ['owned', 'args'], { shell: false });
  return { observer, children, launches, launch, controller };
}

test('native overlap requires actual spawn events and retained scan/encoder lifetimes', async () => {
  const { observer, children, launch, launches } = fixture();
  const scan = observer.enterScan(); await observer.waitForScan();
  launch('encode'); launch('probe'); assert.equal(observer.getState().scanProbeEncodeOverlap, false);
  children[0].emit('spawn'); await observer.waitForEncoder(); children[1].emit('spawn'); await observer.waitForOverlap();
  observer.observeArtworkSpawn(); observer.releaseScan(); await scan; observer.finishScan();
  children.forEach(child => { child.emit('close', 0, null); }); await observer.close();
  assert.deepEqual(observer.getState(), { scanProbeEncodeOverlap: true, scanEncoderArtworkOverlap: true, artworkStarts: 1,
    maximumConcurrentNativeCommands: 2, encoderCommands: 1, probeCommands: 1, normalCloses: 2 });
  assert.deepEqual(launches[0], ['ffmpeg', ['owned', 'args'], { shell: false }]);
});

test('positive native overlap cannot certify a failed command or absent artwork overlap', async () => {
  for (const fails of [true, false]) {
    const { observer, launch, children } = fixture(); const scan = observer.enterScan();
    launch('encode'); children[0].emit('spawn'); launch('probe'); children[1].emit('spawn'); await observer.waitForOverlap();
    if (fails) observer.observeArtworkSpawn();
    observer.releaseScan(); await scan; observer.finishScan();
    children[0].emit('close', fails ? 1 : 0, null); children[1].emit('close', 0, null);
    await assert.rejects(observer.close(), fails ? /command failed/u : /artwork lifetime overlap/u);
  }
});

test('an encoder retiring before a probe refuses overlap and releases the scan during cleanup', async () => {
  const { observer, children, launch } = fixture(); const scan = observer.enterScan(); void scan.catch(() => {});
  launch('encode'); children[0].emit('spawn'); children[0].emit('close', 0, null);
  await assert.rejects(observer.waitForOverlap(), /retired before/u);
  await assert.rejects(scan, /retired before/u); await assert.rejects(observer.close(), /retired before/u);
});

test('close revokes launches but retains ownership until all native children close', async () => {
  const { observer, children, launch } = fixture();
  const scan = observer.enterScan(); launch('encode'); children[0].emit('spawn'); launch('probe'); children[1].emit('spawn');
  observer.observeArtworkSpawn(); let settled = false; const closing = observer.close().then(() => { settled = true; });
  await scan; await Promise.resolve(); assert.equal(settled, false); assert.throws(() => launch('probe'), TypeError);
  children[0].emit('close', 0, null); await Promise.resolve(); assert.equal(settled, false);
  children[1].emit('close', 0, null); await closing; assert.equal(settled, true);
});

test('aborted or failed native evidence preserves the original Error/null and drains close', async () => {
  for (const reason of [new Error('original'), null]) {
    const { observer, controller, launch, children } = fixture();
    const scan = observer.enterScan(); void scan.catch(() => {}); launch('encode'); children[0].emit('spawn');
    controller.abort(reason); await assert.rejects(observer.waitForOverlap(), error => error === reason);
    await assert.rejects(scan, error => error === reason); children[0].emit('close', 0, null);
    await assert.rejects(observer.close(), error => error === reason);
  }
});
