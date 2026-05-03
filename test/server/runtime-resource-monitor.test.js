import assert from 'node:assert/strict';
import { suite, test } from 'node:test';
import { createRuntimeResourceMonitor } from '../../src/server/runtime-resource-monitor.js';

suite('runtime-resource-monitor', () => {
  test('reports memory pressure and stale heartbeats without duplicate warning spam, then recovers', async () => {
    const infoMessages = [];
    const warningMessages = [];
    let sample = {
      activeResources: {
        counts: {},
        total: 0,
      },
      capturedAt: '2026-05-03T12:00:00.000Z',
      memory: {
        heapUsedBytes: 64,
        rssBytes: 180,
      },
    };
    const heartbeatState = {
      getHeartbeatState() {
        return {
          lastTickAt: '2026-05-03T11:59:30.000Z',
        };
      },
    };
    const monitor = createRuntimeResourceMonitor({
      heartbeatDefinitions: [{
        heartbeatState,
        intervalMs: 5000,
        key: 'libraryDiscovery',
        label: 'Discovery dispatch',
      }],
      nowFn: () => new Date('2026-05-03T12:00:00.000Z'),
      onInfo(message) {
        infoMessages.push(message);
      },
      onWarning(message) {
        warningMessages.push(message);
      },
      runtimeResourceService: {
        buildProcessSnapshot() {
          return sample;
        },
        getRuntimeConfiguration() {
          return {
            processMonitoring: {
              heartbeatStaleMultiplier: 3,
              heapUsedWarnBytes: 128,
              intervalMs: 1000,
              rssWarnBytes: 128,
            },
          };
        },
      },
    });

    await monitor.tick();

    let runtimeState = monitor.getRuntimeState();
    assert.equal(runtimeState.status, 'warning');
    assert.equal(runtimeState.warnings.length, 2);
    assert.match(runtimeState.message, /Process RSS/);
    assert.equal(warningMessages.length, 2);

    await monitor.tick();
    assert.equal(warningMessages.length, 2);

    sample = {
      ...sample,
      capturedAt: '2026-05-03T12:00:05.000Z',
      memory: {
        heapUsedBytes: 32,
        rssBytes: 96,
      },
    };
    heartbeatState.getHeartbeatState = () => ({
      lastTickAt: '2026-05-03T11:59:58.000Z',
    });

    await monitor.tick();

    runtimeState = monitor.getRuntimeState();
    assert.equal(runtimeState.status, 'healthy');
    assert.equal(runtimeState.warnings.length, 0);
    assert.deepEqual(infoMessages, ['Runtime monitoring recovered to a healthy state.']);
  });

  test('exposes service-style start and stop hooks', async () => {
    const callOrder = [];
    const monitor = createRuntimeResourceMonitor({
      createIntervalHeartbeatRunnerFn({ onTick }) {
        return {
          start() {
            callOrder.push('start');
            void onTick();
          },
          stop() {
            callOrder.push('stop');
          },
          tick() {
            callOrder.push('tick');
            return onTick();
          },
        };
      },
      runtimeResourceService: {
        buildProcessSnapshot() {
          return {
            activeResources: {
              counts: {},
              total: 0,
            },
            capturedAt: '2026-05-03T12:00:00.000Z',
            memory: {
              heapUsedBytes: 10,
              rssBytes: 10,
            },
          };
        },
        getRuntimeConfiguration() {
          return {
            processMonitoring: {
              heartbeatStaleMultiplier: 3,
              heapUsedWarnBytes: null,
              intervalMs: 1000,
              rssWarnBytes: null,
            },
          };
        },
      },
    });

    monitor.start();
    await monitor.tick();
    await monitor.stop();

    assert.deepEqual(callOrder, ['start', 'tick', 'stop']);
  });
});
