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
  activeFilterCount: {
    type: Number,
    default: 0,
  },
  isLoading: {
    type: Boolean,
    default: false,
  },
  requestKind: {
    type: String,
    default: '',
  },
  requestState: {
    type: String,
    default: '',
  },
  search: {
    type: String,
    default: '',
  },
  sortBy: {
    type: String,
    default: '',
  },
});

defineEmits([
  'apply',
  'reset',
  'update:requestKind',
  'update:requestState',
  'update:search',
  'update:sortBy',
]);
</script>

<template>
  <form class="rlf" @submit.prevent="$emit('apply')">
    <label class="rlf-field">
      <span class="rlf-label">Search</span>
      <input
        :value="search"
        class="rlf-input"
        placeholder="Artist, release, or track"
        type="search"
        @input="$emit('update:search', $event.target.value)"
      />
    </label>

    <label class="rlf-field">
      <span class="rlf-label">Status</span>
      <select
        :value="requestState"
        class="rlf-select"
        @change="$emit('update:requestState', $event.target.value)"
      >
        <option value="">All statuses</option>
        <option value="needs_fetch">Needs fetch</option>
        <option value="needs_review">Needs review</option>
        <option value="already_exists">Already exists</option>
      </select>
    </label>

    <label class="rlf-field">
      <span class="rlf-label">Type</span>
      <select
        :value="requestKind"
        class="rlf-select"
        @change="$emit('update:requestKind', $event.target.value)"
      >
        <option value="">All types</option>
        <option value="release">Release</option>
        <option value="track">Track</option>
        <option value="external_url">Playlist / URL</option>
      </select>
    </label>

    <label class="rlf-field">
      <span class="rlf-label">Sort</span>
      <select
        :value="sortBy"
        class="rlf-select"
        @change="$emit('update:sortBy', $event.target.value)"
      >
        <option value="">Newest first</option>
        <option value="oldest">Oldest first</option>
        <option value="state">By status</option>
        <option value="kind">By type</option>
      </select>
    </label>

    <div class="rlf-actions">
      <button
        :disabled="isLoading"
        class="hx-btn"
        data-variant="primary"
        type="submit"
      >{{ isLoading ? 'Filtering\u2026' : 'Apply' }}</button>
      <button
        class="hx-btn"
        data-variant="ghost"
        type="button"
        @click="$emit('reset')"
      >Reset</button>
    </div>
  </form>
</template>

<style scoped>
.rlf {
  display: flex;
  align-items: flex-end;
  gap: var(--hx-space-3);
  flex-wrap: wrap;
}

.rlf-field {
  display: grid;
  gap: var(--hx-space-1);
}

.rlf-label {
  font-size: var(--hx-text-xs);
  font-weight: 500;
  color: var(--hx-text-muted);
}

.rlf-input,
.rlf-select {
  font-family: var(--hx-font-body);
  font-size: var(--hx-text-sm);
  padding: var(--hx-space-1) var(--hx-space-2);
  border: 1px solid var(--hx-border);
  border-radius: var(--hx-radius);
  background: var(--hx-surface);
  color: var(--hx-text);
  min-width: 0;
}

.rlf-input:focus,
.rlf-select:focus {
  outline: none;
  border-color: var(--hx-primary);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--hx-primary) 25%, transparent);
}

.rlf-actions {
  display: flex;
  gap: var(--hx-space-2);
}

@media (max-width: 640px) {
  .rlf {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
