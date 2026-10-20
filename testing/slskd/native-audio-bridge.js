/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { nativeAudioFiles } from './native-audio-data.js';
import { exportNativeAudioFile } from './native-audio-export.js';

export function createNativeAudioBridge({ docker, fixtureId, providerId }) {
  const evidence = []; let beforeSend = 0;
  const call = async (phase, input = {}) => {
    const body = JSON.stringify(input);
    if (Buffer.byteLength(body) > 16384) throw new RangeError('Audio bridge input exceeds bound');
    return JSON.parse(await docker(['exec', fixtureId, 'node', '/app/testing/slskd/native-audio-cli.js', phase, body]));
  };
  return {
    call,
    service: {
      prepareDownloadDispatch: async () => {
        const binding = await call('prepare');
        return {
          binding, supportsBeforeSend: true,
          assertCurrent: async () => { assert.deepEqual(await call('prepare'), binding); },
          enqueue: async ({ attempt, beforeSend: gate }) => {
            assert.equal(typeof gate, 'function'); await gate(); beforeSend++;
            const response = await call('enqueue', { attempt });
            assert.equal(response.posts, 1); assert.equal(response.postStatus, 201);
            evidence.push({ attemptId: attempt.attemptId, posts: response.posts, postStatus: response.postStatus });
            return response.result;
          },
        };
      },
      getDownloadBatchEvidence: input => call('batch', input),
      getBoundDownloads: input => call('bounds', input),
      getDownloads: input => call('list', input),
    },
    async exportCompleted(downloadsRoot) {
      await call('published');
      const retirement = await call('retire'); assert.equal(retirement.nativeDownloadsRetired, true);
      await docker(['stop', '--time', '5', providerId]);
      const stopped = JSON.parse(await docker(['inspect', providerId]))[0];
      assert.equal(stopped.Id, providerId); assert.equal(stopped.State.Running, false); assert.equal(stopped.State.ExitCode, 0);
      const native = await call('inspect'); const exported = [];
      for (const file of nativeAudioFiles) {
        exported.push(await exportNativeAudioFile({ docker, fixtureId, downloadsRoot, file,
          native: native.find(row => row.filename === file.filename) }));
      }
      assert.equal(beforeSend, 2); assert.equal(evidence.length, 2);
      return { ...retirement, providerStoppedBeforeExport: true, nativeFiles: native, exportedFiles: exported, dispatches: evidence, beforeSend };
    },
  };
}
