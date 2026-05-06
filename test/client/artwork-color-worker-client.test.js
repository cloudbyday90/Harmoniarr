/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * artwork-color-worker-client.test.js
 *
 * Tests the public contract of extractDominantColor via mock replacements of
 * the browser-only globals (Worker, createImageBitmap). Since the module has
 * singleton state, tests are ordered to account for shared state.
 *
 * The module-level worker is reset between test groups by triggering the
 * worker's onerror handler (which sets worker = null inside the client module).
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { withResolvers } from '../../testing/client/promise-helpers.js';

// ---------------------------------------------------------------------------
// Mock Worker class — intercepts messages so tests can reply manually
// ---------------------------------------------------------------------------

let activeMockWorker = null;

class MockWorker {
  constructor() {
    this.onmessage = null;
    this.onerror = null;
    this._messages = [];
    activeMockWorker = this;
  }

  postMessage(data) {
    this._messages.push(data);
  }

  /** Simulate the worker replying with a color result. */
  reply(id, result) {
    if (this.onmessage) {
      this.onmessage({ data: { id, ...result } });
    }
  }

  /** Simulate the worker crashing. */
  crash() {
    if (this.onerror) {
      this.onerror(new Error('worker error'));
    }
  }
}

// ---------------------------------------------------------------------------
// Mock createImageBitmap — returns a minimal transferable fake
// ---------------------------------------------------------------------------

function makeFakeBitmap() {
  return { close() {} };
}

// Set up globals before the module is imported
globalThis.Worker = MockWorker;
globalThis.createImageBitmap = async (_el, _opts) => makeFakeBitmap();

// Import AFTER globals are set so that the module uses our mocks
const { extractDominantColor } = await import('../../src/client/lib/artwork-color-worker-client.js');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('extractDominantColor resolves with a worker color result', async () => {
  const { promise, resolve } = withResolvers();

  const fakeImg = { src: '/cover.jpg' };

  const extractPromise = extractDominantColor(fakeImg);

  // Give the event loop one turn so drainQueue() runs and postMessage is called
  await Promise.resolve();

  // Worker should have received a message
  assert.ok(activeMockWorker, 'Mock worker should have been created');
  assert.ok(activeMockWorker._messages.length > 0, 'Worker should have received a message');

  const { id } = activeMockWorker._messages.at(-1);

  // Simulate worker reply
  activeMockWorker.reply(id, { hue: 210, chroma: 0.22, lightness: 0.58 });

  const result = await extractPromise;
  assert.deepEqual(result, { hue: 210, chroma: 0.22, lightness: 0.58 });

  resolve();
  await promise;
});

test('extractDominantColor resolves with null fields when createImageBitmap throws', async () => {
  const savedCreate = globalThis.createImageBitmap;
  globalThis.createImageBitmap = async () => { throw new Error('bitmap error'); };

  const fakeImg = { src: '/bad.jpg' };
  const result = await extractDominantColor(fakeImg);

  assert.deepEqual(result, { hue: null, chroma: null, lightness: null });

  globalThis.createImageBitmap = savedCreate;
});

test('extractDominantColor resolves pending jobs with null when worker crashes', async () => {
  // Reset the module singleton by crashing the current worker (sets worker = null internally)
  if (activeMockWorker) {
    activeMockWorker.crash();
    activeMockWorker = null;
    // Allow the crash handler to settle
    await Promise.resolve();
  }

  const fakeImg = { src: '/cover2.jpg' };
  const extractPromise = extractDominantColor(fakeImg);

  // Wait for the worker to be created and postMessage called
  await Promise.resolve();

  assert.ok(activeMockWorker, 'A new worker should have been created after crash reset');

  // Crash the worker before it replies
  activeMockWorker.crash();

  const result = await extractPromise;
  assert.deepEqual(result, { hue: null, chroma: null, lightness: null });
});
