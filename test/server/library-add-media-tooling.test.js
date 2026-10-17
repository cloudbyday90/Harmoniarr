/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createFixturePhaseObserver } from '../../testing/integration/fixture-phase-observer.js';
import { createFixtureGate } from '../../testing/integration/fixture-lifecycle.js';
import { verifyLibraryAddMediaTooling } from '../../testing/integration/library-add-media-tooling.js';

test('image tooling phases await each original command before admitting the next or returning', async () => {
  const records = []; const calls = []; const logs = [];
  const identity = createFixtureGate(); const version = createFixtureGate(); const versionEntered = createFixtureGate();
  const observer = createFixturePhaseObserver({ onRecord: record => records.push(record) });
  let returned = false;
  const task = observer.measure('media_tooling', () => verifyLibraryAddMediaTooling({ mediaImage: 'private-image', phaseObserver: observer,
    log: value => logs.push(value), executeFileFn: async (...args) => {
      calls.push(args);
      if (calls.length === 1) { await identity.promise; return { stdout: 'private-identity\n' }; }
      versionEntered.release(); await version.promise; return { stdout: 'private-version\nsecond line' };
    } })).then(result => { returned = true; return result; });
  try {
    assert.equal(calls.length, 1); assert.deepEqual(records, []);
    identity.release(); await versionEntered.promise;
    assert.deepEqual(records.map(row => row.phase), ['media_image_inspect']);
    assert.equal(returned, false); assert.deepEqual(logs, []);
  } finally { identity.release(); version.release(); }
  assert.equal(await task, null);
  assert.deepEqual(calls, [
    ['docker', ['image', 'inspect', 'private-image', '--format', '{{.Id}}']],
    ['docker', ['run', '--rm', '--network', 'none', '--entrypoint', 'ffprobe', 'private-image', '-version']],
  ]);
  assert.deepEqual(logs, ['Local media fixture: private-image private-identity; private-version']);
  assert.deepEqual(records.map(row => row.phase), ['media_image_inspect', 'media_version', 'media_tooling']);
  assert.ok(records.every(row => row.outcome === 'passed' && row.durationMs >= 0));
  assert.equal(new Set(records.map(row => row.correlationId)).size, 1);
  assert.equal(JSON.stringify(records).includes('private'), false);
});

test('local tooling keeps both original version commands with no timing clock or sink when disabled', async () => {
  const calls = [];
  const observer = createFixturePhaseObserver({ enabled: false,
    now: () => assert.fail('Disabled clock'), onRecord: () => assert.fail('Disabled sink') });
  assert.equal(await verifyLibraryAddMediaTooling({ phaseObserver: observer,
    log: () => assert.fail('Local tooling emitted image log'),
    executeFileFn: async (...args) => { calls.push(args); return { stdout: 'local version' }; } }), null);
  assert.deepEqual(calls, [['ffprobe', ['-version']], ['ffmpeg', ['-version']]]);
});

for (const failure of [new Error('private command failure'), null]) {
  for (const failAt of [1, 2]) {
    test(`tooling ${failure === null ? 'null' : 'Error'} at command ${failAt} keeps unavailable semantics and stops admission`, async () => {
      const records = []; let calls = 0;
      const observer = createFixturePhaseObserver({ onRecord: record => records.push(record) });
      const result = await observer.measure('media_tooling', () => verifyLibraryAddMediaTooling({ mediaImage: 'private-image', phaseObserver: observer,
        log: () => assert.fail('Failed tooling emitted success log'), executeFileFn: async () => {
          if (++calls === failAt) throw failure;
          return { stdout: 'private-identity' };
        } }));
      assert.match(result, /^Local ffmpeg\/ffprobe fixture unavailable;/u); assert.equal(calls, failAt);
      assert.equal(records.at(-2).outcome, 'failed');
      // Helper completion is not a claim that the tooling is available.
      assert.equal(records.at(-1).phase, 'media_tooling'); assert.equal(records.at(-1).outcome, 'passed');
      assert.equal(JSON.stringify(records).includes('private'), false);
    });
  }
}

test('optional sink and invalid-clock failures preserve successful tooling and its original command work', async () => {
  for (const options of [{ onRecord: () => { throw null; } }, { onRecord: () => Promise.reject(new Error('private sink')) },
    { now: () => NaN, onRecord: () => assert.fail('Invalid clock published') }]) {
    let calls = 0;
    assert.equal(await verifyLibraryAddMediaTooling({ phaseObserver: createFixturePhaseObserver(options),
      executeFileFn: async () => { calls++; return { stdout: 'current version' }; } }), null);
    assert.equal(calls, 2);
  }
});

test('invalid injected tooling dependencies refuse before native command admission', async () => {
  for (const options of [{ executeFileFn: null }, { log: null }, { phaseObserver: {} }]) {
    await assert.rejects(verifyLibraryAddMediaTooling({ ...options }), TypeError);
  }
});
