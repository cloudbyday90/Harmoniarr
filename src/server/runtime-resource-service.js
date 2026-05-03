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

import { availableParallelism } from 'node:os';
import process from 'node:process';
import sharp from 'sharp';

const defaultMonitorIntervalMs = 60_000;
const defaultHeartbeatStaleMultiplier = 3;
const defaultMediaCommandMaxBufferBytes = 2 * 1024 * 1024;
const defaultMediaCommandTimeoutMs = 30_000;
const defaultMediaCommandKillGraceMs = 5_000;
const defaultSharpCacheMemoryMb = 32;
const defaultSharpCacheFiles = 8;
const defaultSharpCacheItems = 64;

function parseInteger(value, { fallback, min = null, max = null } = {}) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) {
    return fallback;
  }

  if (min !== null && parsed < min) {
    return fallback;
  }

  if (max !== null && parsed > max) {
    return fallback;
  }

  return parsed;
}

function parseOptionalInteger(value, { min = null, max = null } = {}) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) {
    return null;
  }

  if (min !== null && parsed < min) {
    return null;
  }

  if (max !== null && parsed > max) {
    return null;
  }

  return parsed;
}

function toBytesFromMegabytes(value) {
  if (!Number.isInteger(value) || value < 0) {
    return null;
  }

  return value * 1024 * 1024;
}

function normalizeActiveResourceCounts(resourceNames = []) {
  const counts = {};

  for (const name of resourceNames) {
    if (typeof name !== 'string' || name.length === 0) {
      continue;
    }

    counts[name] = (counts[name] ?? 0) + 1;
  }

  return counts;
}

function resolveUvThreadpoolSize(env = process.env) {
  return parseInteger(env.UV_THREADPOOL_SIZE, {
    fallback: 4,
    min: 1,
    max: 1024,
  });
}

export function createRuntimeResourceService({
  availableParallelismFn = availableParallelism,
  env = process.env,
  nowFn = () => new Date(),
  processInfo = process,
  sharpModule = sharp,
} = {}) {
  const cpuCount = availableParallelismFn();
  const normalizedCpuCount = Number.isInteger(cpuCount) && cpuCount > 0 ? cpuCount : 1;
  const uvThreadpoolSize = resolveUvThreadpoolSize(env);
  const sharpConcurrency = parseInteger(env.HARMONIARR_SHARP_CONCURRENCY, {
    fallback: Math.min(normalizedCpuCount, 4),
    min: 1,
    max: Math.max(normalizedCpuCount, 64),
  });
  const sharpCacheMemoryMb = parseInteger(env.HARMONIARR_SHARP_CACHE_MEMORY_MB, {
    fallback: defaultSharpCacheMemoryMb,
    min: 0,
    max: 4096,
  });
  const sharpCacheFiles = parseInteger(env.HARMONIARR_SHARP_CACHE_FILES, {
    fallback: defaultSharpCacheFiles,
    min: 0,
    max: 4096,
  });
  const sharpCacheItems = parseInteger(env.HARMONIARR_SHARP_CACHE_ITEMS, {
    fallback: defaultSharpCacheItems,
    min: 0,
    max: 4096,
  });
  const mediaCommandMaxBufferBytes = parseInteger(env.HARMONIARR_MEDIA_COMMAND_MAX_BUFFER_BYTES, {
    fallback: defaultMediaCommandMaxBufferBytes,
    min: 16 * 1024,
    max: 64 * 1024 * 1024,
  });
  const mediaCommandTimeoutMs = parseInteger(env.HARMONIARR_MEDIA_COMMAND_TIMEOUT_MS, {
    fallback: defaultMediaCommandTimeoutMs,
    min: 1000,
    max: 30 * 60 * 1000,
  });
  const mediaCommandKillGraceMs = parseInteger(env.HARMONIARR_MEDIA_COMMAND_KILL_GRACE_MS, {
    fallback: defaultMediaCommandKillGraceMs,
    min: 250,
    max: 60 * 1000,
  });
  const ffmpegThreads = parseInteger(env.HARMONIARR_FFMPEG_THREADS, {
    fallback: Math.min(normalizedCpuCount, 4),
    min: 1,
    max: Math.max(normalizedCpuCount, 64),
  });
  const monitorIntervalMs = parseInteger(env.HARMONIARR_RUNTIME_MONITOR_INTERVAL_MS, {
    fallback: defaultMonitorIntervalMs,
    min: 1000,
    max: 30 * 60 * 1000,
  });
  const heartbeatStaleMultiplier = parseInteger(env.HARMONIARR_RUNTIME_HEARTBEAT_STALE_MULTIPLIER, {
    fallback: defaultHeartbeatStaleMultiplier,
    min: 2,
    max: 20,
  });
  const rssWarnMb = parseOptionalInteger(env.HARMONIARR_RUNTIME_RSS_WARN_MB, {
    min: 32,
    max: 1024 * 1024,
  });
  const heapUsedWarnMb = parseOptionalInteger(env.HARMONIARR_RUNTIME_HEAP_USED_WARN_MB, {
    min: 16,
    max: 1024 * 1024,
  });

  function applyProcessRuntimePreferences({
    onInfo = () => {},
    onWarning = () => {},
  } = {}) {
    if (sharpModule) {
      sharpModule.cache({
        files: sharpCacheFiles,
        items: sharpCacheItems,
        memory: sharpCacheMemoryMb,
      });
      sharpModule.concurrency(sharpConcurrency);

      onInfo(
        `configured sharp runtime: concurrency=${sharpConcurrency} cacheMemoryMb=${sharpCacheMemoryMb} cacheFiles=${sharpCacheFiles} cacheItems=${sharpCacheItems}`,
      );
    }

    if (normalizedCpuCount > 4 && uvThreadpoolSize < normalizedCpuCount) {
      onWarning(
        `UV_THREADPOOL_SIZE=${uvThreadpoolSize} may underutilize native work on a ${normalizedCpuCount}-core host; configure it before process start if higher sharp parallelism is required`,
      );
    }
  }

  function getRuntimeConfiguration() {
    return {
      mediaCommands: {
        defaultKillGraceMs: mediaCommandKillGraceMs,
        defaultMaxBufferBytes: mediaCommandMaxBufferBytes,
        defaultTimeoutMs: mediaCommandTimeoutMs,
        ffmpegThreads,
      },
      processMonitoring: {
        heartbeatStaleMultiplier,
        heapUsedWarnBytes: toBytesFromMegabytes(heapUsedWarnMb),
        intervalMs: monitorIntervalMs,
        rssWarnBytes: toBytesFromMegabytes(rssWarnMb),
      },
      sharp: sharpModule
        ? {
          cache: {
            files: sharpCacheFiles,
            items: sharpCacheItems,
            memoryMb: sharpCacheMemoryMb,
          },
          concurrency: sharpConcurrency,
        }
        : null,
      threading: {
        availableParallelism: normalizedCpuCount,
        uvThreadpoolSize,
      },
    };
  }

  function getMediaCommandDefaults() {
    return {
      defaultKillGraceMs: mediaCommandKillGraceMs,
      defaultMaxBuffer: mediaCommandMaxBufferBytes,
      defaultTimeoutMs: mediaCommandTimeoutMs,
    };
  }

  function buildProcessSnapshot() {
    const memoryUsage = typeof processInfo.memoryUsage === 'function'
      ? processInfo.memoryUsage()
      : {};
    const resourceUsage = typeof processInfo.resourceUsage === 'function'
      ? processInfo.resourceUsage()
      : null;
    const activeResources = typeof processInfo.getActiveResourcesInfo === 'function'
      ? processInfo.getActiveResourcesInfo()
      : [];

    return {
      activeResources: {
        counts: normalizeActiveResourceCounts(activeResources),
        total: activeResources.length,
      },
      capturedAt: nowFn().toISOString(),
      memory: {
        arrayBuffersBytes: memoryUsage.arrayBuffers ?? null,
        externalBytes: memoryUsage.external ?? null,
        heapTotalBytes: memoryUsage.heapTotal ?? null,
        heapUsedBytes: memoryUsage.heapUsed ?? null,
        rssBytes: memoryUsage.rss ?? null,
      },
      pid: processInfo.pid ?? null,
      resourceUsage: resourceUsage
        ? {
          fsRead: resourceUsage.fsRead ?? null,
          fsWrite: resourceUsage.fsWrite ?? null,
          majorPageFault: resourceUsage.majorPageFault ?? null,
          maxRssBytes: Number.isInteger(resourceUsage.maxRSS)
            ? resourceUsage.maxRSS * 1024
            : null,
          minorPageFault: resourceUsage.minorPageFault ?? null,
          systemCpuTimeMicros: resourceUsage.systemCPUTime ?? null,
          userCpuTimeMicros: resourceUsage.userCPUTime ?? null,
        }
        : null,
      sharp: sharpModule
        ? {
          cache: sharpModule.cache(),
          concurrency: sharpModule.concurrency(),
          counters: typeof sharpModule.counters === 'function' ? sharpModule.counters() : null,
        }
        : null,
      threading: {
        availableParallelism: normalizedCpuCount,
        uvThreadpoolSize,
      },
    };
  }

  return {
    applyProcessRuntimePreferences,
    buildProcessSnapshot,
    getMediaCommandDefaults,
    getRuntimeConfiguration,
  };
}
