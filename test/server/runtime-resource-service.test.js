import assert from 'node:assert/strict';
import { suite, test } from 'node:test';
import { createRuntimeResourceService } from '../../src/server/runtime-resource-service.js';

function createSharpMock() {
  const state = {
    cache: {
      files: 20,
      items: 100,
      memory: 50,
    },
    concurrency: 1,
  };

  return {
    cache(options) {
      if (options) {
        state.cache = { ...state.cache, ...options };
      }

      return { ...state.cache };
    },
    concurrency(value) {
      if (Number.isInteger(value)) {
        state.concurrency = value;
      }

      return state.concurrency;
    },
    counters() {
      return {
        process: 1,
        queue: 2,
      };
    },
  };
}

suite('runtime-resource-service', () => {
  test('builds runtime configuration, applies sharp tuning, and captures process snapshots', () => {
    const sharpModule = createSharpMock();
    const infoMessages = [];
    const warningMessages = [];
    const service = createRuntimeResourceService({
      availableParallelismFn: () => 12,
      env: {
        HARMONIARR_FFMPEG_THREADS: '6',
        HARMONIARR_MEDIA_COMMAND_KILL_GRACE_MS: '7000',
        HARMONIARR_MEDIA_COMMAND_MAX_BUFFER_BYTES: '2097152',
        HARMONIARR_MEDIA_COMMAND_TIMEOUT_MS: '45000',
        HARMONIARR_RUNTIME_HEAP_USED_WARN_MB: '128',
        HARMONIARR_RUNTIME_HEARTBEAT_STALE_MULTIPLIER: '4',
        HARMONIARR_RUNTIME_MONITOR_INTERVAL_MS: '15000',
        HARMONIARR_RUNTIME_RSS_WARN_MB: '512',
        HARMONIARR_SHARP_CACHE_FILES: '6',
        HARMONIARR_SHARP_CACHE_ITEMS: '80',
        HARMONIARR_SHARP_CACHE_MEMORY_MB: '24',
        HARMONIARR_SHARP_CONCURRENCY: '3',
        UV_THREADPOOL_SIZE: '4',
      },
      nowFn: () => new Date('2026-05-03T12:00:00.000Z'),
      processInfo: {
        getActiveResourcesInfo() {
          return ['PipeWrap', 'PipeWrap', 'TTYWrap'];
        },
        memoryUsage() {
          return {
            arrayBuffers: 4,
            external: 8,
            heapTotal: 16,
            heapUsed: 12,
            rss: 20,
          };
        },
        pid: 9876,
        resourceUsage() {
          return {
            fsRead: 10,
            fsWrite: 11,
            majorPageFault: 2,
            maxRSS: 32,
            minorPageFault: 7,
            systemCPUTime: 200,
            userCPUTime: 300,
          };
        },
      },
      sharpModule,
    });

    service.applyProcessRuntimePreferences({
      onInfo(message) {
        infoMessages.push(message);
      },
      onWarning(message) {
        warningMessages.push(message);
      },
    });

    assert.deepEqual(service.getRuntimeConfiguration(), {
      mediaCommands: {
        defaultKillGraceMs: 7000,
        defaultMaxBufferBytes: 2097152,
        defaultTimeoutMs: 45000,
        ffmpegThreads: 6,
      },
      processMonitoring: {
        heartbeatStaleMultiplier: 4,
        heapUsedWarnBytes: 134217728,
        intervalMs: 15000,
        rssWarnBytes: 536870912,
      },
      sharp: {
        cache: {
          files: 6,
          items: 80,
          memoryMb: 24,
        },
        concurrency: 3,
      },
      threading: {
        availableParallelism: 12,
        uvThreadpoolSize: 4,
      },
    });
    assert.deepEqual(service.getMediaCommandDefaults(), {
      defaultKillGraceMs: 7000,
      defaultMaxBuffer: 2097152,
      defaultTimeoutMs: 45000,
    });
    assert.equal(infoMessages.length, 1);
    assert.match(infoMessages[0], /configured sharp runtime/);
    assert.equal(warningMessages.length, 1);
    assert.match(warningMessages[0], /UV_THREADPOOL_SIZE=4/);
    assert.deepEqual(service.buildProcessSnapshot(), {
      activeResources: {
        counts: {
          PipeWrap: 2,
          TTYWrap: 1,
        },
        total: 3,
      },
      capturedAt: '2026-05-03T12:00:00.000Z',
      memory: {
        arrayBuffersBytes: 4,
        externalBytes: 8,
        heapTotalBytes: 16,
        heapUsedBytes: 12,
        rssBytes: 20,
      },
      pid: 9876,
      resourceUsage: {
        fsRead: 10,
        fsWrite: 11,
        majorPageFault: 2,
        maxRssBytes: 32768,
        minorPageFault: 7,
        systemCpuTimeMicros: 200,
        userCpuTimeMicros: 300,
      },
      sharp: {
        cache: {
          files: 6,
          items: 80,
          memory: 24,
        },
        concurrency: 3,
        counters: {
          process: 1,
          queue: 2,
        },
      },
      threading: {
        availableParallelism: 12,
        uvThreadpoolSize: 4,
      },
    });
  });
});
