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

export function createIntervalHeartbeatRunner({
  clearIntervalFn = clearInterval,
  intervalMs,
  onTick = async () => ({ skipped: false }),
  onTickInProgress = async () => ({
    reason: 'tick_in_progress',
    skipped: true,
  }),
  setIntervalFn = setInterval,
} = {}) {
  let intervalHandle = null;
  let isTickRunning = false;

  async function tick() {
    if (isTickRunning) {
      return onTickInProgress();
    }

    isTickRunning = true;

    try {
      return await onTick();
    } finally {
      isTickRunning = false;
    }
  }

  function start() {
    if (intervalHandle) {
      return intervalHandle;
    }

    intervalHandle = setIntervalFn(() => {
      void tick();
    }, intervalMs);

    if (typeof intervalHandle?.unref === 'function') {
      intervalHandle.unref();
    }

    void tick();
    return intervalHandle;
  }

  function stop() {
    if (!intervalHandle) {
      return;
    }

    clearIntervalFn(intervalHandle);
    intervalHandle = null;
  }

  return {
    start,
    stop,
    tick,
  };
}