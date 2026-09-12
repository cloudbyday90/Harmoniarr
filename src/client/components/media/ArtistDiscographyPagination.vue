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
import { computed } from 'vue';
const props = defineProps({
  pagination: { type: Object, required: true },
  loading: Boolean,
  error: { type: String, default: null },
});
const emit = defineEmits(['load-more']);
const summary = computed(() => {
  const { loaded, total, complete, source, hasMore } = props.pagination;
  if (source === 'local') return `${loaded} local release groups loaded. ${hasMore ? 'More groups may be available.' : 'End of the current local catalog traversal.'}`;
  if (total !== null) return `${loaded} of ${total} catalog release groups loaded${complete ? '.' : ' so far.'}`;
  return `${loaded} catalog release groups loaded. The catalog total is unavailable.`;
});
function loadMore() {
  if (!props.loading && props.pagination.hasMore) emit('load-more');
}
</script>

<template>
  <div class="artist-discography-pagination">
    <p role="status" aria-atomic="true">{{ loading ? 'Loading more release groups…' : summary }}</p>
    <p v-if="error" role="alert">{{ error }}</p>
    <p v-if="pagination.source === 'local'">Filters, sorting, and bulk changes apply to loaded release groups.</p>
    <p v-else-if="!pagination.complete">Filters apply to loaded release groups.</p>
    <button
      type="button"
      class="hx-btn"
      :aria-disabled="loading || !pagination.hasMore"
      :aria-busy="loading"
      @click="loadMore"
    >{{ loading ? 'Loading…' : pagination.hasMore ? (error ? 'Retry loading release groups' : 'Load more release groups') : pagination.source === 'local' ? 'No further local release groups' : pagination.complete ? 'All catalog release groups loaded' : 'No further catalog page available' }}</button>
  </div>
</template>

<style scoped>
.artist-discography-pagination { display: grid; gap: var(--hx-space-2); justify-items: start; }
.artist-discography-pagination p { margin: 0; color: var(--hx-text-muted); font-size: var(--hx-text-sm); }
.artist-discography-pagination [aria-disabled="true"] { cursor: default; }
.artist-discography-pagination button:focus-visible { outline-color: var(--hx-accent-strong); }
</style>
