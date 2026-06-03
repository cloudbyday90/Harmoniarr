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
// Presentational search input for Discover. Owns no business logic: it binds
// the query through `v-model` and reports submission upward so the container
// can run the search (props-down / events-up).
const query = defineModel({ type: String, default: '' });

defineProps({
  isSearching: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['submit']);

function handleSubmit() {
  emit('submit');
}
</script>

<template>
  <form class="discover-search" role="search" @submit.prevent="handleSubmit">
    <div class="discover-search__row">
      <input
        id="discover-query"
        v-model="query"
        class="hx-input discover-search__input"
        type="search"
        placeholder="Search for an artist by name"
        autocomplete="off"
        :disabled="isSearching"
        aria-label="Search for an artist"
      />
      <button
        type="submit"
        class="hx-btn"
        data-variant="primary"
        :disabled="isSearching || !query.trim()"
        :aria-busy="isSearching || undefined"
      >
        {{ isSearching ? 'Searching...' : 'Search' }}
      </button>
    </div>
  </form>
</template>

<style scoped>
.discover-search {
  display: block;
}

.discover-search__row {
  display: flex;
  gap: var(--hx-space-2);
  align-items: center;
}

.discover-search__input {
  flex: 1;
  min-width: 0;
}

@media (max-width: 640px) {
  .discover-search__row {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
