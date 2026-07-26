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
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import EmptyState from '../components/EmptyState.vue';
import { useActivityFeed } from '../composables/useActivityFeed.js';
import {
  formatActivityEventTime,
  getActivityEventDetail,
  getActivityEventLabel,
} from '../lib/activity-event-normalization.js';
import { buildActivityEventLinkTarget } from '../lib/activity-event-link-targets.js';
import {
  ACTIVITY_TIMELINE_FILTERS,
  filterActivityTimelineEvents,
  getActivityTimelineEventPresentation,
} from '../lib/activity-timeline-presentation.js';
import {
  buildActivityTimelineStoryEntries,
  getActivityTimelineStoryDisclosureLabel,
} from '../lib/activity-timeline-story-presentation.js';
import { sessionStore } from '../state/session.js';

const selectedFilter = ref('all');
const {
  events,
  isLoading,
  isRevalidating,
  errorMessage,
  checkedAt,
  hasEvents,
  isEmpty,
  load,
  destroy,
  attachVisibilityListener,
} = useActivityFeed({
  limit: 100,
  pollIntervalMs: 30000,
  revalidateOnFocus: true,
});

const currentUserId = sessionStore.state.user?.id ?? null;
const visibleEvents = computed(() => filterActivityTimelineEvents(events.value, selectedFilter.value));
const visibleEventCount = computed(() => visibleEvents.value.length);
const visibleEntries = computed(() => buildActivityTimelineStoryEntries(visibleEvents.value));
const visibleEntryCount = computed(() => visibleEntries.value.length);
const hasVisibleEntries = computed(() => visibleEntryCount.value > 0);

function selectFilter(filter) {
  selectedFilter.value = filter;
}

function getFilterLabel(filter) {
  return ACTIVITY_TIMELINE_FILTERS.find((item) => item.value === filter)?.label ?? 'Activity';
}

function getEventLinkTarget(event) {
  return buildActivityEventLinkTarget(event);
}

onMounted(() => {
  attachVisibilityListener();
  void load();
});

onBeforeUnmount(() => {
  destroy();
});
</script>

<template>
  <section class="activity-feed-view" aria-labelledby="activity-timeline-title">
    <header class="activity-feed-header">
      <div>
        <h2 id="activity-timeline-title" class="activity-feed-title">Recent activity</h2>
        <p>Progress, changes, and the few things that need help.</p>
      </div>
      <button type="button" class="hx-btn" :disabled="isLoading || isRevalidating" @click="load()">
        {{ isLoading || isRevalidating ? 'Refreshing...' : 'Refresh' }}
      </button>
    </header>

    <div class="activity-filter-bar" role="group" aria-label="Filter activity">
      <button
        v-for="filter in ACTIVITY_TIMELINE_FILTERS"
        :key="filter.value"
        type="button"
        class="activity-filter"
        :aria-pressed="selectedFilter === filter.value"
        @click="selectFilter(filter.value)"
      >
        {{ filter.label }}
      </button>
    </div>

    <p class="activity-feed-status" role="status" aria-live="polite">
      <template v-if="isLoading">Loading recent activity...</template>
      <template v-else-if="hasEvents">
        Showing {{ visibleEntryCount }} {{ visibleEntryCount === 1 ? 'timeline item' : 'timeline items' }} from {{ visibleEventCount }} {{ visibleEventCount === 1 ? 'event' : 'events' }} in {{ getFilterLabel(selectedFilter).toLowerCase() }}.
      </template>
    </p>

    <EmptyState
      v-if="errorMessage"
      :title="errorMessage"
      body="Check your connection and refresh the timeline."
    />

    <EmptyState
      v-else-if="isEmpty"
      title="Nothing to show yet"
      body="Progress will appear here as Harmoniarr searches, downloads, checks audio, and adds music to your library."
    />

    <EmptyState
      v-else-if="!isLoading && !hasVisibleEntries"
      :title="`No ${getFilterLabel(selectedFilter).toLowerCase()} yet`"
      body="Try another filter to see more recent activity."
    />

    <ol v-else class="activity-timeline" aria-label="Activity timeline">
      <li v-for="entry in visibleEntries" :key="entry.id" class="activity-timeline-item">
        <article
          class="activity-timeline-entry"
          :data-event-type="entry.event.eventType"
          :data-tone="getActivityTimelineEventPresentation(entry.event).tone"
        >
          <span class="activity-timeline-marker" aria-hidden="true" />
          <div class="activity-timeline-content">
            <div class="activity-timeline-meta">
              <span class="hx-pill" :data-tone="getActivityTimelineEventPresentation(entry.event).tone">
                {{ getActivityTimelineEventPresentation(entry.event).categoryLabel }}
              </span>
              <time v-if="entry.event.occurredAt" :datetime="entry.event.occurredAt">
                {{ formatActivityEventTime(entry.event.occurredAt) }}
              </time>
            </div>
            <h3>{{ getActivityEventLabel(entry.event, currentUserId) }}</h3>
            <p v-if="getActivityEventDetail(entry.event)">{{ getActivityEventDetail(entry.event) }}</p>
            <details v-if="entry.isCoalesced" class="activity-timeline-story-details">
              <summary>{{ getActivityTimelineStoryDisclosureLabel(entry) }}</summary>
              <ol aria-label="Release activity updates">
                <li v-for="milestone in entry.milestoneEvents" :key="milestone.id">
                  <span>{{ getActivityEventLabel(milestone, currentUserId) }}</span>
                  <time v-if="milestone.occurredAt" :datetime="milestone.occurredAt">
                    {{ formatActivityEventTime(milestone.occurredAt) }}
                  </time>
                </li>
              </ol>
            </details>
            <RouterLink
              v-if="getEventLinkTarget(entry.event)"
              class="activity-timeline-link"
              :to="getEventLinkTarget(entry.event).to"
            >
              {{ getEventLinkTarget(entry.event).label }}
            </RouterLink>
          </div>
        </article>
      </li>
    </ol>

    <p v-if="checkedAt && !isLoading" class="activity-feed-checked-at" aria-live="polite">
      <span v-if="isRevalidating" aria-hidden="true">Refreshing. </span>
      Last checked {{ formatActivityEventTime(checkedAt) }}.
    </p>
  </section>
</template>

<style scoped>
.activity-feed-view {
  display: grid;
  gap: var(--hx-space-4);
}

.activity-feed-header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: var(--hx-space-4);
}

.activity-feed-title,
.activity-timeline-entry h3 {
  margin: 0;
  color: var(--hx-text-strong);
}

.activity-feed-title {
  font-size: var(--hx-text-xl);
}

.activity-feed-header p,
.activity-timeline-entry p,
.activity-feed-status,
.activity-feed-checked-at {
  margin: var(--hx-space-1) 0 0;
  color: var(--hx-text-muted);
  font-size: var(--hx-text-sm);
}

.activity-filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: var(--hx-space-2);
}

.activity-filter {
  border: 1px solid var(--hx-border);
  border-radius: var(--hx-radius-pill);
  background: transparent;
  color: var(--hx-text-muted);
  cursor: pointer;
  padding: 6px 10px;
  font: inherit;
  font-size: var(--hx-text-sm);
}

.activity-filter:hover,
.activity-filter:focus-visible,
.activity-filter[aria-pressed='true'] {
  border-color: var(--hx-accent);
  background: var(--hx-accent-soft);
  color: var(--hx-text-strong);
}

.activity-feed-status {
  min-height: 1.25rem;
  margin: 0;
}

.activity-timeline {
  list-style: none;
  margin: 0;
  padding: 0;
}

.activity-timeline-item {
  position: relative;
  padding: 0 0 var(--hx-space-4) var(--hx-space-5);
}

.activity-timeline-item::before {
  position: absolute;
  top: 1.1rem;
  bottom: 0;
  left: 7px;
  width: 1px;
  background: var(--hx-border-subtle);
  content: '';
}

.activity-timeline-item:last-child {
  padding-bottom: 0;
}

.activity-timeline-item:last-child::before {
  display: none;
}

.activity-timeline-entry {
  position: relative;
  display: grid;
  gap: var(--hx-space-3);
  border-bottom: 1px solid var(--hx-border-subtle);
  padding: 0 0 var(--hx-space-4);
}

.activity-timeline-item:last-child .activity-timeline-entry {
  border-bottom: 0;
  padding-bottom: 0;
}

.activity-timeline-marker {
  position: absolute;
  top: 0.55rem;
  left: calc(-1 * var(--hx-space-5));
  width: 14px;
  height: 14px;
  border: 3px solid var(--hx-bg-canvas);
  border-radius: 50%;
  background: var(--hx-info);
}

.activity-timeline-entry[data-tone='success'] .activity-timeline-marker {
  background: var(--hx-success);
}

.activity-timeline-entry[data-tone='warning'] .activity-timeline-marker {
  background: var(--hx-warning);
}

.activity-timeline-content {
  min-width: 0;
}

.activity-timeline-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--hx-space-3);
  margin-bottom: var(--hx-space-2);
}

.activity-timeline-meta time {
  color: var(--hx-text-faint);
  font-size: var(--hx-text-sm);
  white-space: nowrap;
}

.activity-timeline-entry h3 {
  font-size: var(--hx-text-base);
}

.activity-timeline-link {
  display: inline-flex;
  margin-top: var(--hx-space-2);
  color: var(--hx-accent);
  font-size: var(--hx-text-sm);
  font-weight: 600;
  text-decoration: none;
}

.activity-timeline-link:hover,
.activity-timeline-link:focus-visible {
  text-decoration: underline;
}

.activity-timeline-story-details {
  margin-top: var(--hx-space-2);
}

.activity-timeline-story-details summary {
  color: var(--hx-accent);
  cursor: pointer;
  font-size: var(--hx-text-sm);
  font-weight: 600;
}

.activity-timeline-story-details summary:focus-visible {
  border-radius: var(--hx-radius-xs);
  outline: 2px solid var(--hx-accent);
  outline-offset: 2px;
}

.activity-timeline-story-details ol {
  display: grid;
  gap: var(--hx-space-2);
  margin: var(--hx-space-3) 0 0;
  padding: var(--hx-space-3);
  border-left: 2px solid var(--hx-border);
  color: var(--hx-text-muted);
  font-size: var(--hx-text-sm);
  list-style: none;
}

.activity-timeline-story-details li {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--hx-space-3);
}

.activity-timeline-story-details time {
  color: var(--hx-text-faint);
  font-size: var(--hx-text-xs);
  white-space: nowrap;
}

.activity-feed-checked-at {
  margin: 0;
}

@media (max-width: 640px) {
  .activity-feed-header {
    align-items: stretch;
    flex-direction: column;
  }

  .activity-feed-header .hx-btn {
    align-self: start;
  }

  .activity-timeline-meta {
    align-items: start;
    flex-direction: column-reverse;
    gap: var(--hx-space-1);
  }
}
</style>
