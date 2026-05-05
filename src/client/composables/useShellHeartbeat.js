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

import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

const HEALTH_REFRESH_MS = 30_000;

function selectWorstStatus(statuses) {
  if (statuses.includes('unavailable') || statuses.includes('error')) {
    return 'unavailable';
  }
  if (statuses.includes('degraded') || statuses.includes('rate_limited') || statuses.includes('misconfigured')) {
    return 'degraded';
  }
  if (statuses.includes('healthy')) {
    return 'healthy';
  }
  return 'unknown';
}

export function useShellHeartbeat() {
  const status = ref('unknown');
  const detail = ref('Checking dependencies');
  const activeJobs = ref(null);
  let timer = null;
  let aborted = false;

  async function fetchOnce() {
    try {
      const response = await fetch('/api/v1/overview', {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) {
        if (response.status === 401) {
          status.value = 'unknown';
          detail.value = 'Sign in required';
          return;
        }
        status.value = 'degraded';
        detail.value = `Overview returned ${response.status}`;
        return;
      }

      const payload = await response.json();
      const dependencies = Array.isArray(payload?.dependencies) ? payload.dependencies : [];
      const heartbeats = Array.isArray(payload?.heartbeats) ? payload.heartbeats : [];
      const allStatuses = [
        ...dependencies.map((d) => String(d?.status ?? '').toLowerCase()),
        ...heartbeats.map((h) => String(h?.status ?? '').toLowerCase()),
      ].filter(Boolean);

      const worst = selectWorstStatus(allStatuses);
      status.value = worst === 'unknown' ? 'healthy' : worst;
      detail.value = worst === 'healthy'
        ? 'All dependencies healthy'
        : worst === 'degraded'
          ? 'Some dependencies degraded'
          : worst === 'unavailable'
            ? 'Dependencies unavailable'
            : 'Health unknown';

      const jobs = payload?.activeJobCount;
      if (typeof jobs === 'number') {
        activeJobs.value = jobs;
      }
    } catch {
      if (aborted) return;
      status.value = 'unavailable';
      detail.value = 'Unable to reach overview API';
    }
  }

  onMounted(() => {
    void fetchOnce();
    timer = setInterval(fetchOnce, HEALTH_REFRESH_MS);
  });

  onBeforeUnmount(() => {
    aborted = true;
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  });

  const label = computed(() => {
    switch (status.value) {
      case 'healthy': return 'Healthy';
      case 'degraded': return 'Degraded';
      case 'unavailable': return 'Unavailable';
      default: return 'Health';
    }
  });

  return { status, detail, activeJobs, label, refresh: fetchOnce };
}
