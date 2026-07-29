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
  folderPath: {
    type: String,
    default: '',
  },
  isLoadingQueue: {
    type: Boolean,
    default: false,
  },
  sourceSearchId: {
    type: String,
    default: '',
  },
  status: {
    type: String,
    default: 'pending',
  },
  username: {
    type: String,
    default: '',
  },
});

const emit = defineEmits([
  'apply-filters',
  'reset-filters',
  'update:folder-path',
  'update:source-search-id',
  'update:status',
  'update:username',
]);

function updateField(event, eventName) {
  emit(eventName, event.target.value);
}
</script>

<template>
  <form class="review-filter-grid import-candidate-filters" @submit.prevent="$emit('apply-filters')">
    <label>
      Status
      <select :value="status" @change="updateField($event, 'update:status')">
        <option value="">All statuses</option>
        <option value="pending">Pending</option>
        <option value="held">Paused</option>
        <option value="rejected">Not using</option>
        <option value="selected">Selected</option>
        <option value="downloading">Downloading</option>
        <option value="import_pending">Ready to add</option>
        <option value="applied">In library</option>
        <option value="failed">Needs attention</option>
      </select>
    </label>

    <label>
      Search reference
      <input
        :value="sourceSearchId"
        placeholder="search-123"
        @input="updateField($event, 'update:source-search-id')"
      />
    </label>

    <label>
      Source user
      <input
        :value="username"
        placeholder="source-user"
        @input="updateField($event, 'update:username')"
      />
    </label>

    <label>
      Folder path
      <input
        :value="folderPath"
        placeholder="Autechre\\Amber"
        @input="updateField($event, 'update:folder-path')"
      />
    </label>

    <div class="review-filter-actions">
      <button type="submit" :disabled="isLoadingQueue">
        {{ isLoadingQueue ? 'Refreshing...' : 'Find matches' }}
      </button>
      <button type="button" class="secondary-button review-reset-button" @click="$emit('reset-filters')">
        Clear
      </button>
    </div>
  </form>
</template>
