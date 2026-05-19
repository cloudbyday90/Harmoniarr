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
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useGlobalSearch } from '../composables/useGlobalSearch.js';

const props = defineProps({
  open: { type: Boolean, default: false },
});

const emit = defineEmits(['close']);

const {
  activeIndex,
  errorMessage,
  flatResults,
  handleEnter,
  handleKeydown,
  hasAnyResults,
  hasArtistResults,
  hasReleaseGroupResults,
  hasReleaseResults,
  loading,
  navigateToResult,
  query,
  results,
  resetQuery,
  scheduleSearch,
  totalResultCount,
} = useGlobalSearch();

const inputRef = ref(null);
const listRef = ref(null);

watch(query, (value) => {
  scheduleSearch(value);
});

function close() {
  emit('close');
}

function onPanelKeydown(event) {
  if (event.key === 'Escape') {
    event.preventDefault();
    close();
    return;
  }

  if (event.key === 'Enter') {
    event.preventDefault();
    const handled = handleEnter({ close });
    if (!handled) return;
  }

  handleKeydown(event);
}

function onResultClick(entry) {
  navigateToResult(entry, { close });
}

function onFocusOut(event) {
  requestAnimationFrame(() => {
    const panel = event.currentTarget;
    if (panel && !panel.contains(document.activeElement)) {
      close();
    }
  });
}

watch(() => props.open, async (isOpen) => {
  if (isOpen) {
    resetQuery();
    await nextTick();
    inputRef.value?.focus();
  }
});

onMounted(() => {
  if (props.open) {
    nextTick(() => inputRef.value?.focus());
  }
});

const activeEntry = computed(() => {
  if (activeIndex.value < 0 || activeIndex.value >= flatResults.value.count) {
    return null;
  }
  return flatResults.value.items[activeIndex.value];
});

function isEntryActive(type, item) {
  if (!activeEntry.value) return false;
  return activeEntry.value.type === type && activeEntry.value.item === item;
}

function resultItemId(type, index) {
  return `search-result-${type}-${index}`;
}

const isMac = typeof navigator !== 'undefined'
  ? navigator.platform?.toLowerCase().includes('mac') ?? false
  : false;

const shortcutKey = isMac ? 'Cmd+K' : 'Ctrl+K';
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="hx-search-overlay" @click.self="close">
      <div
        class="hx-search-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Global search"
        @keydown="onPanelKeydown"
        @focusout="onFocusOut"
      >
        <div class="hx-search-header">
          <svg class="hx-search-header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7"/>
            <path d="m20 20-3.5-3.5"/>
          </svg>
          <input
            ref="inputRef"
            v-model="query"
            class="hx-search-input"
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="search-results-list"
            aria-activedescendant=""
            aria-autocomplete="list"
            aria-label="Search artists, releases, and more"
            placeholder="Search artists, albums, releases..."
            autocomplete="off"
            spellcheck="false"
          />
          <kbd class="hx-search-shortcut" aria-hidden="true">{{ shortcutKey }}</kbd>
        </div>

        <div
          id="search-results-list"
          ref="listRef"
          class="hx-search-results"
          role="listbox"
          aria-label="Search results"
        >
          <div v-if="loading" class="hx-search-status" role="status">
            <span class="hx-search-status-label">Searching...</span>
          </div>

          <div v-else-if="errorMessage" class="hx-search-status" role="alert">
            <span class="hx-search-status-label" data-tone="danger">{{ errorMessage }}</span>
          </div>

          <div v-else-if="query.length >= 2 && !hasAnyResults" class="hx-search-status" role="status">
            <span class="hx-search-status-label">No results for "{{ query }}"</span>
          </div>

          <template v-else-if="hasAnyResults">
            <div v-if="hasArtistResults" class="hx-search-group" role="group" aria-label="Artists">
              <div class="hx-search-group-label">
                <svg class="hx-search-group-label-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
                  <circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>
                </svg>
                Artists
              </div>
              <button
                v-for="(artist, i) in results.artists"
                :key="artist.id"
                :id="resultItemId('artist', i)"
                class="hx-search-item"
                :class="{ 'is-active': isEntryActive('artist', artist) }"
                role="option"
                :aria-selected="isEntryActive('artist', artist)"
                @click="onResultClick({ type: 'artist', item: artist })"
                @mousemove="activeIndex = flatResults.items.findIndex(e => e.type === 'artist' && e.item === artist)"
              >
                <span class="hx-search-item-text">
                  <strong>{{ artist.name }}</strong>
                  <small v-if="artist.disambiguation" class="hx-search-item-disambig">{{ artist.disambiguation }}</small>
                </span>
              </button>
              <div v-if="results.artists.length === 5" class="hx-search-group-more">
                {{ results.artists.length === 5 ? 'Showing top results' : '' }}
              </div>
            </div>

            <div v-if="hasReleaseGroupResults" class="hx-search-group" role="group" aria-label="Albums">
              <div class="hx-search-group-label">
                <svg class="hx-search-group-label-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
                  <circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5"/>
                </svg>
                Albums
              </div>
              <button
                v-for="(rg, i) in results.releaseGroups"
                :key="rg.id"
                :id="resultItemId('releaseGroup', i)"
                class="hx-search-item"
                :class="{ 'is-active': isEntryActive('releaseGroup', rg) }"
                role="option"
                :aria-selected="isEntryActive('releaseGroup', rg)"
                @click="onResultClick({ type: 'releaseGroup', item: rg })"
                @mousemove="activeIndex = flatResults.items.findIndex(e => e.type === 'releaseGroup' && e.item === rg)"
              >
                <span class="hx-search-item-text">
                  <strong>{{ rg.title }}</strong>
                  <small>{{ rg.artistName }}</small>
                </span>
                <span class="hx-search-item-meta" v-if="rg.primaryType">{{ rg.primaryType }}{{ rg.firstReleaseDate ? ' \u00B7 ' + new Date(rg.firstReleaseDate).getFullYear() : '' }}</span>
              </button>
            </div>

            <div v-if="hasReleaseResults" class="hx-search-group" role="group" aria-label="Releases">
              <div class="hx-search-group-label">
                <svg class="hx-search-group-label-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
                  <path d="M12 2a10 10 0 0 0-2 19.8V22h4v-.2A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"/>
                  <circle cx="12" cy="12" r="2"/>
                </svg>
                Releases
              </div>
              <button
                v-for="(release, i) in results.releases"
                :key="release.id"
                :id="resultItemId('release', i)"
                class="hx-search-item"
                :class="{ 'is-active': isEntryActive('release', release) }"
                role="option"
                :aria-selected="isEntryActive('release', release)"
                @click="onResultClick({ type: 'release', item: release })"
                @mousemove="activeIndex = flatResults.items.findIndex(e => e.type === 'release' && e.item === release)"
              >
                <span class="hx-search-item-text">
                  <strong>{{ release.title }}</strong>
                  <small>{{ release.artistName }}</small>
                </span>
                <span class="hx-search-item-meta" v-if="release.releaseDate">{{ new Date(release.releaseDate).getFullYear() }}{{ release.country ? ' \u00B7 ' + release.country : '' }}</span>
              </button>
            </div>
          </template>
        </div>

        <div class="hx-search-footer" aria-hidden="true">
          <span class="hx-search-footer-hint">
            <kbd>&uarr;&darr;</kbd> Navigate
          </span>
          <span class="hx-search-footer-hint">
            <kbd>&crarr;</kbd> Open
          </span>
          <span class="hx-search-footer-hint">
            <kbd>Esc</kbd> Close
          </span>
          <span v-if="totalResultCount > 0" class="hx-search-footer-count">
            {{ totalResultCount }} result{{ totalResultCount === 1 ? '' : 's' }}
          </span>
        </div>
      </div>
    </div>
  </Teleport>
</template>
