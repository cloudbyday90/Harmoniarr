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

import { createIntervalHeartbeatRunner } from './heartbeat/interval-heartbeat-runner.js';
import { resolveHeartbeatOverviewState } from './heartbeat/heartbeat-overview.js';
import { createRuntimeResourceService } from './runtime-resource-service.js';

function buildHeartbeatStaleWarning({
  ageMs,
  key,
  label,
  lastTickAt,
  staleAfterMs,
}) {
  return {
    ageMs,
    code: 'runtime_heartbeat_stale',
    key,
    label,
    lastTickAt,
    message: `${label} has not recorded a heartbeat for ${Math.round(ageMs / 1000)}s (threshold ${Math.round(staleAfterMs / 1000)}s).`,
    type: 'heartbeat',
  };
}

function buildMemoryThresholdWarning({
  actualBytes,
  code,
  label,
  thresholdBytes,
}) {
  return {
    actualBytes,
    code,
    message: `${label} is ${Math.round(actualBytes / (1024 * 1024))}MB (threshold ${Math.round(thresholdBytes / (1024 * 1024))}MB).`,
    thresholdBytes,
    type: 'memory',
  };
}

function normalizeHeartbeatDefinitions(definitions = [], staleMultiplier) {
  return definitions
    .filter((definition) => definition?.key && definition?.label)
    .map((definition) => ({
      ...definition,
      staleAfterMs: Number.isInteger(definition.staleAfterMs) && definition.staleAfterMs > 0
        ? definition.staleAfterMs
        : (definition.intervalMs ?? 0) * staleMultiplier,
    }))
    .filter((definition) => Number.isInteger(definition.staleAfterMs) && definition.staleAfterMs > 0);
}

function buildWarningSignature(warnings = []) {
  return warnings
    .map((warning) => `${warning.code}:${warning.key ?? ''}:${warning.actualBytes ?? ''}:${warning.lastTickAt ?? ''}`)
    .sort()
    .join('|');
}

export function createRuntimeResourceMonitor({
  createIntervalHeartbeatRunnerFn = createIntervalHeartbeatRunner,
  heartbeatDefinitions = [],
  onInfo = () => {},
  onWarning = () => {},
  nowFn = () => new Date(),
  runtimeResourceService = createRuntimeResourceService(),
} = {}) {
  const configuration = runtimeResourceService.getRuntimeConfiguration();
  const resolvedHeartbeatDefinitions = normalizeHeartbeatDefinitions(
    heartbeatDefinitions,
    configuration.processMonitoring.heartbeatStaleMultiplier,
  );
  const intervalMs = configuration.processMonitoring.intervalMs;
  let currentHandlers = { onInfo, onWarning };
  let state = {
    checkedAt: null,
    latestSample: null,
    message: 'Runtime monitoring has not recorded a sample yet.',
    status: 'waiting',
    warnings: [],
  };
  let lastWarningSignature = '';

  function setLogHandlers({
    onInfo: nextOnInfo = currentHandlers.onInfo,
    onWarning: nextOnWarning = currentHandlers.onWarning,
  } = {}) {
    currentHandlers = {
      onInfo: nextOnInfo,
      onWarning: nextOnWarning,
    };
  }

  function evaluateWarnings(sample) {
    const warnings = [];
    const rssWarnBytes = configuration.processMonitoring.rssWarnBytes;
    const heapUsedWarnBytes = configuration.processMonitoring.heapUsedWarnBytes;

    if (Number.isInteger(rssWarnBytes) && rssWarnBytes > 0 && sample.memory.rssBytes > rssWarnBytes) {
      warnings.push(buildMemoryThresholdWarning({
        actualBytes: sample.memory.rssBytes,
        code: 'runtime_rss_threshold_exceeded',
        label: 'Process RSS',
        thresholdBytes: rssWarnBytes,
      }));
    }

    if (Number.isInteger(heapUsedWarnBytes) && heapUsedWarnBytes > 0 && sample.memory.heapUsedBytes > heapUsedWarnBytes) {
      warnings.push(buildMemoryThresholdWarning({
        actualBytes: sample.memory.heapUsedBytes,
        code: 'runtime_heap_threshold_exceeded',
        label: 'Process heap usage',
        thresholdBytes: heapUsedWarnBytes,
      }));
    }

    const now = nowFn();
    for (const definition of resolvedHeartbeatDefinitions) {
      const heartbeatState = resolveHeartbeatOverviewState(definition.heartbeatState);
      const lastTickAt = heartbeatState?.lastTickAt ?? null;
      if (!lastTickAt) {
        continue;
      }

      const ageMs = now.getTime() - new Date(lastTickAt).getTime();
      if (ageMs > definition.staleAfterMs) {
        warnings.push(buildHeartbeatStaleWarning({
          ageMs,
          key: definition.key,
          label: definition.label,
          lastTickAt,
          staleAfterMs: definition.staleAfterMs,
        }));
      }
    }

    return warnings;
  }

  function updateState(sample) {
    const warnings = evaluateWarnings(sample);
    const nextSignature = buildWarningSignature(warnings);
    const hasWarnings = warnings.length > 0;

    state = {
      checkedAt: sample.capturedAt,
      latestSample: sample,
      message: hasWarnings
        ? warnings[0].message
        : 'Runtime monitoring has not detected resource pressure or stale worker heartbeats.',
      status: hasWarnings ? 'warning' : 'healthy',
      warnings,
    };

    if (nextSignature !== lastWarningSignature) {
      if (hasWarnings) {
        for (const warning of warnings) {
          currentHandlers.onWarning(warning.message, { warning });
        }
      } else if (lastWarningSignature.length > 0) {
        currentHandlers.onInfo('Runtime monitoring recovered to a healthy state.');
      }

      lastWarningSignature = nextSignature;
    }
  }

  const runner = createIntervalHeartbeatRunnerFn({
    intervalMs,
    onTick: async () => {
      const sample = runtimeResourceService.buildProcessSnapshot();
      updateState(sample);
      return {
        skipped: false,
        warningCount: state.warnings.length,
      };
    },
  });

  function getRuntimeState() {
    return {
      ...state,
    };
  }

  return {
    getRuntimeState,
    setLogHandlers,
    start() {
      runner.start();
    },
    async stop() {
      runner.stop();
    },
    tick() {
      return runner.tick();
    },
  };
}
