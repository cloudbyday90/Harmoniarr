<!--
  Harmoniarr - Soulseek-native music library management
  Copyright (C) 2026 Harmoniarr Contributors

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with this program. If not, see <https://www.gnu.org/licenses/>.
-->

<script setup>
import { computed, useId } from 'vue';

const relativeTimeFormatter = new Intl.RelativeTimeFormat(undefined, {
  numeric: 'auto',
  style: 'short',
});

function formatRelativeAge(ms) {
  if (!Number.isFinite(ms) || ms < 0) {
    return '';
  }

  if (ms < 30000) {
    return 'just now';
  }

  const seconds = Math.round(ms / 1000);
  if (seconds < 60) {
    return relativeTimeFormatter.format(-seconds, 'second');
  }

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return relativeTimeFormatter.format(-minutes, 'minute');
  }

  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return relativeTimeFormatter.format(-hours, 'hour');
  }

  return relativeTimeFormatter.format(-Math.round(hours / 24), 'day');
}

const props = defineProps({
  label: {
    type: String,
    required: true,
  },
  progress: {
    type: Object,
    required: true,
  },
});

const descriptionId = useId();

const isDeterminate = computed(() =>
  props.progress?.mode === 'determinate'
  && Number.isFinite(Number(props.progress?.percentComplete)),
);

const percentComplete = computed(() => {
  if (!isDeterminate.value) {
    return null;
  }

  return Math.max(0, Math.min(100, Math.round(Number(props.progress.percentComplete))));
});

const progressStyle = computed(() => ({
  '--request-stage-progress-percent': `${percentComplete.value ?? 0}%`,
}));

const freshness = computed(() => props.progress?.freshness ?? 'unknown');
const freshnessLabel = computed(() => {
  if (freshness.value === 'stale') {
    return 'May be stale';
  }

  if (freshness.value === 'unknown') {
    return 'Freshness unknown';
  }

  return '';
});

const observedAtDate = computed(() => {
  const observedAt = props.progress?.observedAt;
  if (!observedAt) {
    return null;
  }

  const parsed = new Date(observedAt);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
});

const observedAtLabel = computed(() => {
  if (!observedAtDate.value) {
    return '';
  }

  const relativeAge = formatRelativeAge(props.progress?.observedAgeMs);
  return relativeAge ? `Observed ${relativeAge}` : 'Observed';
});

const observedAtTitle = computed(() => {
  if (!observedAtDate.value) {
    return '';
  }

  return observedAtDate.value.toLocaleString();
});

const progressText = computed(() => {
  if (isDeterminate.value) {
    return `${percentComplete.value}% downloaded`;
  }

  if (props.progress?.status === 'queued') {
    return 'Waiting for transfer to start';
  }

  return 'Transfer active; percentage not available yet';
});

const valueText = computed(() =>
  isDeterminate.value
    ? [progressText.value, freshnessLabel.value, observedAtLabel.value].filter(Boolean).join(', ')
    : undefined,
);
</script>

<template>
  <div
    class="rsp"
    :data-freshness="freshness"
    :data-mode="isDeterminate ? 'determinate' : 'indeterminate'"
  >
    <div
      class="rsp-track"
      role="progressbar"
      :aria-label="label"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-valuenow="isDeterminate ? percentComplete : undefined"
      :aria-valuetext="valueText"
      :aria-describedby="descriptionId"
    >
      <span class="rsp-fill" :style="progressStyle" aria-hidden="true"></span>
    </div>
    <span :id="descriptionId" class="rsp-text">
      <span>{{ progressText }}</span>
      <span v-if="freshnessLabel" class="rsp-freshness">{{ freshnessLabel }}</span>
      <time
        v-if="observedAtLabel"
        class="rsp-observed"
        :datetime="progress.observedAt"
        :title="observedAtTitle"
      >{{ observedAtLabel }}</time>
    </span>
  </div>
</template>

<style scoped>
.rsp {
  display: grid;
  gap: var(--hx-space-1, 0.25rem);
  max-width: 22rem;
}

.rsp-track {
  position: relative;
  height: 0.5rem;
  overflow: hidden;
  border-radius: var(--hx-radius-pill, 999px);
  background: var(--hx-bg-surface-sunken, rgba(15, 23, 42, 0.12));
  border: 1px solid var(--hx-border, rgba(148, 163, 184, 0.35));
}

.rsp-fill {
  position: absolute;
  inset-block: 0;
  inset-inline-start: 0;
  width: var(--request-stage-progress-percent, 0%);
  border-radius: inherit;
  background: linear-gradient(90deg, var(--hx-accent-strong, #2f86d6), var(--hx-accent, #5eadff));
  transition: width 180ms ease;
}

.rsp[data-mode='indeterminate'] .rsp-fill {
  width: 40%;
  min-width: 5rem;
  background: linear-gradient(
    90deg,
    transparent,
    color-mix(in srgb, var(--hx-accent, #5eadff) 65%, transparent),
    transparent
  );
}

.rsp[data-freshness='stale'] .rsp-track {
  border-color: color-mix(in srgb, var(--hx-warning, #c08a16) 45%, var(--hx-border, rgba(148, 163, 184, 0.35)));
}

.rsp[data-freshness='stale'] .rsp-fill {
  background: linear-gradient(90deg, var(--hx-warning, #c08a16), var(--hx-accent, #5eadff));
}

.rsp-text {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: var(--hx-space-2, 0.5rem);
  font-size: var(--hx-text-xs, 0.72rem);
  color: var(--hx-text-muted, #94a3b8);
}

.rsp-freshness {
  font-weight: 600;
  color: var(--hx-warning, #c08a16);
}

.rsp-observed {
  color: var(--hx-text-faint, #64748b);
}

@media (prefers-reduced-motion: reduce) {
  .rsp-fill {
    transition: none;
  }
}
</style>
