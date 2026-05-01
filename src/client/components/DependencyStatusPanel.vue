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
const props = defineProps({
  dependencies: {
    type: Array,
    default: () => [],
  },
});

defineEmits(['refresh']);

const statusLabels = {
  degraded: 'Degraded',
  healthy: 'Healthy',
  misconfigured: 'Misconfigured',
  unavailable: 'Unavailable',
};

function formatProvider(provider) {
  if (provider === 'musicbrainz') {
    return 'MusicBrainz';
  }

  if (provider === 'slskd') {
    return 'slskd';
  }

  return provider;
}

function formatStatus(status) {
  return statusLabels[status] ?? status;
}

function formatDetailKey(key) {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (letter) => letter.toUpperCase());
}
</script>

<template>
  <article class="panel-light dependency-panel">
    <div class="section-header">
      <div>
        <p class="eyebrow">Dependencies</p>
        <h3>Provider health</h3>
      </div>
      <button type="button" @click="$emit('refresh')">Refresh</button>
    </div>

    <div class="dependency-grid" v-if="props.dependencies.length" role="status" aria-live="polite">
      <article
        class="dependency-card"
        v-for="dependency in props.dependencies"
        :key="dependency.provider"
        :class="`dependency-card-${dependency.status}`"
      >
        <div class="dependency-card-header">
          <div>
            <p>{{ formatProvider(dependency.provider) }}</p>
            <strong>{{ formatStatus(dependency.status) }}</strong>
          </div>
          <span class="dependency-status-dot" aria-hidden="true"></span>
        </div>

        <p class="dependency-message" v-if="dependency.message">{{ dependency.message }}</p>

        <dl v-if="dependency.details">
          <div v-for="(value, key) in dependency.details" :key="key">
            <dt>{{ formatDetailKey(key) }}</dt>
            <dd>{{ value }}</dd>
          </div>
        </dl>

        <p class="dependency-observed" v-if="dependency.observedAt">
          Last observed {{ dependency.observedAt }}
        </p>
      </article>
    </div>

    <p class="dependency-empty" v-else>No dependency observations recorded yet.</p>
  </article>
</template>
