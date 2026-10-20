/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */


import assert from 'node:assert/strict';
import test from 'node:test';
import { createNativeAudioBridge } from '../../testing/slskd/native-audio-bridge.js';

test('audio bridge withholds native POST until durable beforeSend completion and checks current binding', async () => {
  const phases = []; const binding = { version: '0.26.1.0', endpointFingerprint: 'owned' };
  let drift = false;
  const bridge = createNativeAudioBridge({ fixtureId: 'fixture', providerId: 'provider', docker: async args => {
    const phase = args[4]; phases.push(phase);
    return JSON.stringify(phase === 'prepare' ? { ...binding, ...(drift ? { endpointFingerprint: 'changed' } : {}) }
      : { result: { accepted: true }, posts: 1, postStatus: 201 });
  } });
  const dispatch = await bridge.service.prepareDownloadDispatch(); assert.equal(dispatch.supportsBeforeSend, true);
  await dispatch.assertCurrent();
  let release;
  const held = new Promise(resolve => { release = resolve; });
  const pending = dispatch.enqueue({ attempt: { attemptId: 'controlled' }, beforeSend: () => held });
  assert.deepEqual(phases, ['prepare', 'prepare']); release();
  assert.deepEqual(await pending, { accepted: true }); assert.equal(phases.at(-1), 'enqueue');
  drift = true; await assert.rejects(dispatch.assertCurrent());
});

test('audio bridge preserves durable gate Error or null without native enqueue', async () => {
  let enqueues = 0;
  const bridge = createNativeAudioBridge({ fixtureId: 'fixture', docker: async args => {
    if (args[4] === 'enqueue') enqueues++;
    return '{}';
  } });
  const dispatch = await bridge.service.prepareDownloadDispatch();
  for (const failure of [new Error('durable refusal'), null]) {
    await assert.rejects(dispatch.enqueue({ beforeSend: async () => { throw failure; } }), error => error === failure);
  }
  await assert.rejects(dispatch.enqueue({})); assert.equal(enqueues, 0);
});
