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
defineProps({
  progress: {
    required: true,
    type: Object,
  },
});
</script>

<template>
  <section class="music-queue-release-progress" aria-labelledby="music-queue-release-progress-heading">
    <div>
      <h3 id="music-queue-release-progress-heading">Progress</h3>
      <p>{{ progress.summary }}</p>
    </div>
    <ol class="music-queue-release-progress__steps">
      <li
        v-for="step in progress.steps"
        :key="step.id"
        :aria-current="step.isCurrent ? 'step' : undefined"
        :data-state="step.state"
      >
        <span class="music-queue-release-progress__marker" aria-hidden="true"></span>
        <div>
          <p class="music-queue-release-progress__label">
            <strong>{{ step.label }}</strong>
            <span>{{ step.stateLabel }}</span>
          </p>
          <p>{{ step.detail }}</p>
        </div>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.music-queue-release-progress {
  display: grid;
  gap: var(--hx-space-3);
  margin-top: var(--hx-space-5);
  padding-top: var(--hx-space-5);
  border-top: 1px solid var(--hx-border);
}

.music-queue-release-progress > div,
.music-queue-release-progress p,
.music-queue-release-progress h3 {
  margin: 0;
}

.music-queue-release-progress > div {
  display: grid;
  gap: var(--hx-space-1);
}

.music-queue-release-progress > div > p,
.music-queue-release-progress__steps li > div > p:last-child {
  color: var(--hx-text-muted);
}

.music-queue-release-progress__steps {
  display: grid;
  gap: var(--hx-space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}

.music-queue-release-progress__steps li {
  display: grid;
  gap: var(--hx-space-2);
  grid-template-columns: auto minmax(0, 1fr);
}

.music-queue-release-progress__marker {
  align-self: start;
  block-size: 10px;
  inline-size: 10px;
  margin-top: 5px;
  border: 2px solid var(--hx-border-strong);
  border-radius: 999px;
}

.music-queue-release-progress__steps li[data-state='complete'] .music-queue-release-progress__marker {
  border-color: var(--hx-success);
  background: var(--hx-success);
}

.music-queue-release-progress__steps li[data-state='current'] .music-queue-release-progress__marker {
  border-color: var(--hx-accent);
  background: var(--hx-accent);
}

.music-queue-release-progress__steps li[data-state='attention'] .music-queue-release-progress__marker {
  border-color: var(--hx-warning);
  background: var(--hx-warning);
}

.music-queue-release-progress__label {
  display: flex;
  gap: var(--hx-space-2);
  align-items: baseline;
}

.music-queue-release-progress__label span {
  color: var(--hx-text-muted);
  font-size: var(--hx-text-xs);
}

.music-queue-release-progress__steps li > div {
  display: grid;
  gap: var(--hx-space-1);
}
</style>
