import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { createStartupServiceSupervisor } from '../../src/server/startup-service-supervisor.js';

test('createStartupServiceSupervisor starts services in registration order and stops them in reverse order', async () => {
  const calls = [];
  const supervisor = createStartupServiceSupervisor({
    processEmitter: new EventEmitter(),
  });

  supervisor.registerService({
    start() {
      calls.push('start:first');
    },
    async stop() {
      calls.push('stop:first');
    },
  });
  supervisor.registerService({
    start() {
      calls.push('start:second');
    },
    async stop() {
      calls.push('stop:second');
    },
  });

  supervisor.startAll();
  await supervisor.stopAll();

  assert.deepEqual(calls, [
    'start:first',
    'start:second',
    'stop:second',
    'stop:first',
  ]);
});

test('createStartupServiceSupervisor installs signal handlers and only runs shutdown once', async () => {
  const processEmitter = new EventEmitter();
  const calls = [];
  const supervisor = createStartupServiceSupervisor({ processEmitter });

  supervisor.registerService({
    start() {},
    async stop() {
      calls.push('stop');
    },
  });

  let releaseShutdown = null;
  supervisor.installSignalHandlers(async (signal) => {
    calls.push(`signal:${signal}`);
    await supervisor.shutdown({
      onShutdown: async () => new Promise((resolve) => {
        releaseShutdown = () => {
          calls.push('shutdown');
          resolve();
        };
      }),
    });
  });

  processEmitter.emit('SIGINT', 'SIGINT');
  processEmitter.emit('SIGTERM', 'SIGTERM');
  await Promise.resolve();
  await Promise.resolve();

  assert.deepEqual(calls, [
    'signal:SIGINT',
    'stop',
  ]);

  releaseShutdown();
  await Promise.resolve();

  assert.deepEqual(calls, [
    'signal:SIGINT',
    'stop',
    'shutdown',
  ]);
  assert.equal(processEmitter.listenerCount('SIGINT'), 0);
  assert.equal(processEmitter.listenerCount('SIGTERM'), 0);
});

test('createStartupServiceSupervisor rejects invalid services', () => {
  const supervisor = createStartupServiceSupervisor({
    processEmitter: new EventEmitter(),
  });

  assert.throws(() => {
    supervisor.registerService({ start() {} });
  }, /start\(\) and stop\(\)/);
});