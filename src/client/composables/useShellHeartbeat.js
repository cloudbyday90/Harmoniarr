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

import { computed, ref } from 'vue';
import { fetchSystemOverview as defaultFetchSystemOverview } from '../lib/system-api.js';
import {
  buildShellHeartbeatDetail,
  buildShellHeartbeatStatusLabel,
  selectWorstDependencyStatus,
} from '../lib/heartbeat-presentation.js';

const DEFAULT_POLL_INTERVAL_MS = 30_000;

export function useShellHeartbeat({
  fetchSystemOverview = defaultFetchSystemOverview,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  revalidateOnFocus = false,
} = {}) {
  const status = ref('unknown');
  const detail = ref('Checking dependencies');
  const activeJobs = ref(null);
  const isRevalidating = ref(false);

  let pollTimer = null;
  let destroyed = false;
  let hasLoaded = false;

  function clearPollTimer() {
    if (pollTimer !== null) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
  }

  function schedulePoll() {
    clearPollTimer();
    if (!pollIntervalMs || pollIntervalMs <= 0) return;
    if (destroyed) return;
    if (!hasLoaded) return;

    pollTimer = setTimeout(async () => {
      if (destroyed) return;
      await revalidate();
    }, pollIntervalMs);
  }

  function handleVisibilityChange() {
    if (typeof document === 'undefined' || document.hidden || destroyed || !hasLoaded) return;
    void revalidate().then(() => {
      if (!destroyed) schedulePoll();
    });
  }

  function destroy() {
    destroyed = true;
    clearPollTimer();
    if (revalidateOnFocus && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
  }

  function attachVisibilityListener() {
    if (revalidateOnFocus && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }
  }

  async function refresh() {
    if (destroyed) return;
    isRevalidating.value = true;

    try {
      const payload = await fetchSystemOverview();
      if (destroyed) return;

      const dependencies = Array.isArray(payload?.dependencies) ? payload.dependencies : [];
      const heartbeats = Array.isArray(payload?.heartbeats) ? payload.heartbeats : [];
      const allStatuses = [
        ...dependencies.map((d) => String(d?.status ?? '').toLowerCase()),
        ...heartbeats.map((h) => String(h?.status ?? '').toLowerCase()),
      ].filter(Boolean);

      const worst = selectWorstDependencyStatus(allStatuses);
      status.value = worst === 'unknown' ? 'healthy' : worst;
      detail.value = buildShellHeartbeatDetail(worst === 'unknown' ? 'healthy' : worst);

      const jobs = payload?.activeJobCount;
      if (typeof jobs === 'number') {
        activeJobs.value = jobs;
      }

      hasLoaded = true;
    } catch (error) {
      if (destroyed) return;
      if (error?.status === 401) {
        status.value = 'unknown';
        detail.value = 'Sign in required';
        hasLoaded = true;
        return;
      }
      status.value = 'unavailable';
      detail.value = 'Unable to reach overview API';
      hasLoaded = true;
    } finally {
      if (!destroyed) {
        isRevalidating.value = false;
        schedulePoll();
      }
    }
  }

  async function revalidate() {
    if (destroyed) return;
    isRevalidating.value = true;

    try {
      const payload = await fetchSystemOverview();
      if (destroyed) return;

      const dependencies = Array.isArray(payload?.dependencies) ? payload.dependencies : [];
      const heartbeats = Array.isArray(payload?.heartbeats) ? payload.heartbeats : [];
      const allStatuses = [
        ...dependencies.map((d) => String(d?.status ?? '').toLowerCase()),
        ...heartbeats.map((h) => String(h?.status ?? '').toLowerCase()),
      ].filter(Boolean);

      const worst = selectWorstDependencyStatus(allStatuses);
      status.value = worst === 'unknown' ? 'healthy' : worst;
      detail.value = buildShellHeartbeatDetail(worst === 'unknown' ? 'healthy' : worst);

      const jobs = payload?.activeJobCount;
      if (typeof jobs === 'number') {
        activeJobs.value = jobs;
      }
    } catch {
      // Preserve stale data on revalidation error.
    } finally {
      if (!destroyed) {
        isRevalidating.value = false;
        schedulePoll();
      }
    }
  }

  const label = computed(() => buildShellHeartbeatStatusLabel(status.value));

  return {
    activeJobs,
    attachVisibilityListener,
    detail,
    destroy,
    isRevalidating,
    label,
    refresh,
    revalidate,
    status,
  };
}
