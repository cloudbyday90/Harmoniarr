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
import ActivityResourceState from '../components/activity/ActivityResourceState.vue';
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
  partitionActivityTimelineEvents,
} from '../lib/activity-timeline-presentation.js';
import {
  buildActivityTimelineStoryEntries,
  getActivityTimelineStoryDisclosureLabel,
} from '../lib/activity-timeline-story-presentation.js';
import { sessionStore } from '../state/session.js';

const selectedFilter = ref('all');
const isInitialLoadPending = ref(true);
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
const filteredEvents = computed(() => filterActivityTimelineEvents(events.value, selectedFilter.value));
const visibleEventCount = computed(() => filteredEvents.value.length);
const eventPartition = computed(() => partitionActivityTimelineEvents(filteredEvents.value));
const attentionEntries = computed(() => buildActivityTimelineStoryEntries(eventPartition.value.attentionEvents));
const routineEntries = computed(() => buildActivityTimelineStoryEntries(eventPartition.value.routineEvents));
const visibleEntryCount = computed(() => attentionEntries.value.length + routineEntries.value.length);
const hasVisibleEntries = computed(() => visibleEntryCount.value > 0);
const timelineSections = computed(() => {
  const sections = [];

  if (attentionEntries.value.length > 0) {
    sections.push({
      description: 'Harmoniarr paused automatic progress for these items. Choose the linked action to continue.',
      entries: attentionEntries.value,
      id: 'attention',
      title: 'Needs attention',
    });
  }

  if (routineEntries.value.length > 0) {
    sections.push({
      description: '',
      entries: routineEntries.value,
      id: 'routine',
      title: 'Recent activity',
    });
  }

  return sections;
});

function selectFilter(filter) {
  selectedFilter.value = filter;
}

function getFilterLabel(filter) {
  return ACTIVITY_TIMELINE_FILTERS.find((item) => item.value === filter)?.label ?? 'Activity';
}

function getActivityEventLinkTarget(event, sectionId) {
  return sectionId === 'attention' || event?.eventType === 'artist_policy_saved'
    ? buildActivityEventLinkTarget(event)
    : null;
}

onMounted(() => {
  attachVisibilityListener();
  void load().finally(() => {
    isInitialLoadPending.value = false;
  });
});

onBeforeUnmount(() => {
  destroy();
});
</script>

<template>
  <section class="activity-feed-view" aria-labelledby="activity-timeline-title">
    <header class="activity-feed-header">
      <h2 id="activity-timeline-title" class="activity-feed-title">Activity timeline</h2>
      <div class="activity-feed-actions">
        <time v-if="checkedAt && !isLoading" class="activity-feed-freshness" :datetime="checkedAt">
          Updated {{ formatActivityEventTime(checkedAt) }}
        </time>
        <button type="button" class="hx-btn" :disabled="isLoading || isRevalidating" @click="load()">
          {{ isLoading || isRevalidating ? 'Refreshing...' : 'Refresh' }}
        </button>
      </div>
    </header>

    <div class="activity-feed-toolbar">
      <div class="activity-filter-field">
        <label for="activity-filter">Show activity</label>
        <select
          id="activity-filter"
          class="hx-select activity-filter-select"
          :value="selectedFilter"
          @change="selectFilter($event.target.value)"
        >
          <option v-for="filter in ACTIVITY_TIMELINE_FILTERS" :key="filter.value" :value="filter.value">
            {{ filter.label }}
          </option>
        </select>
      </div>

      <p v-if="!isLoading && !isInitialLoadPending && hasEvents" class="activity-feed-status" role="status" aria-live="polite">
        Showing {{ visibleEntryCount }} {{ visibleEntryCount === 1 ? 'timeline item' : 'timeline items' }} from {{ visibleEventCount }} {{ visibleEventCount === 1 ? 'event' : 'events' }} in {{ getFilterLabel(selectedFilter).toLowerCase() }}.
      </p>
    </div>

    <ActivityResourceState
      v-if="errorMessage"
      state="error"
      title="Could not load activity"
      description="Activity may be temporarily unavailable. Try again to refresh the timeline."
      action-label="Try again"
      :compact="hasEvents"
      @action="load"
    />

    <template v-if="!errorMessage || hasEvents">
      <ActivityResourceState
        v-if="isLoading || isInitialLoadPending"
        state="loading"
        title="Loading recent activity..."
        :skeleton-lines="3"
      />

      <ActivityResourceState
        v-else-if="isEmpty"
        state="empty"
        title="Nothing to show yet"
        description="Progress will appear here as Harmoniarr searches, downloads, checks audio, and adds music to your library."
      />

      <ActivityResourceState
        v-else-if="!isLoading && !hasVisibleEntries"
        state="empty"
        :title="`No ${getFilterLabel(selectedFilter).toLowerCase()} yet`"
        description="Try another filter to see more recent activity."
      />

      <div v-else class="activity-timeline-sections">
        <section
          v-for="section in timelineSections"
          :key="section.id"
          class="activity-timeline-section"
          :class="{ 'activity-timeline-section--attention': section.id === 'attention' }"
          :aria-labelledby="section.title ? `activity-${section.id}-title` : undefined"
        >
          <header v-if="section.title" class="activity-timeline-section-header">
            <div>
              <h3 :id="`activity-${section.id}-title`">{{ section.title }}</h3>
              <p v-if="section.description">{{ section.description }}</p>
            </div>
            <span v-if="section.id === 'attention'" class="hx-pill" data-tone="warning">
              {{ section.entries.length }} {{ section.entries.length === 1 ? 'item' : 'items' }}
            </span>
          </header>

          <ol
            class="activity-timeline"
            :aria-busy="isLoading || isRevalidating"
            :aria-label="section.title"
          >
            <li v-for="entry in section.entries" :key="entry.id" class="activity-timeline-item">
              <article
                class="activity-timeline-entry"
                :data-event-type="entry.event.eventType"
                :data-tone="getActivityTimelineEventPresentation(entry.event).tone"
              >
                <span class="activity-timeline-marker" aria-hidden="true" />
                <div class="activity-timeline-content">
                  <div class="activity-timeline-meta">
                    <time v-if="entry.event.occurredAt" :datetime="entry.event.occurredAt">
                      {{ formatActivityEventTime(entry.event.occurredAt) }}
                    </time>
                  </div>
                  <h4>{{ getActivityEventLabel(entry.event, currentUserId) }}</h4>
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
                    v-if="getActivityEventLinkTarget(entry.event, section.id)"
                    class="activity-timeline-link"
                    :to="getActivityEventLinkTarget(entry.event, section.id).to"
                  >
                    {{ getActivityEventLinkTarget(entry.event, section.id).label }}
                  </RouterLink>
                </div>
              </article>
            </li>
          </ol>
        </section>
      </div>
    </template>

  </section>
</template>

<style scoped>
.activity-feed-view {
  display: grid;
  gap: var(--hx-space-4);
}

.activity-feed-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--hx-space-4);
}

.activity-feed-title {
  margin: 0;
  color: var(--hx-text-strong);
}

.activity-timeline-entry h4,
.activity-timeline-section h3 {
  color: var(--hx-text-strong);
  margin: 0;
}

.activity-feed-title {
  font-size: var(--hx-text-xl);
}

.activity-timeline-entry p,
.activity-feed-status,
.activity-feed-freshness {
  margin: var(--hx-space-1) 0 0;
  color: var(--hx-text-muted);
  font-size: var(--hx-text-sm);
}

.activity-feed-actions,
.activity-feed-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--hx-space-2);
}

.activity-feed-toolbar {
  flex-wrap: wrap;
  gap: var(--hx-space-3);
}

.activity-filter-field {
  display: flex;
  align-items: center;
  gap: var(--hx-space-2);
  color: var(--hx-text-muted);
  font-size: var(--hx-text-sm);
  font-weight: 600;
}

.activity-filter-select {
  min-height: 36px;
  margin: 0;
  min-width: 10rem;
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

.activity-timeline-sections {
  display: grid;
  gap: var(--hx-space-5);
}

.activity-timeline-section {
  min-width: 0;
}

.activity-timeline-section--attention {
  border-left: 3px solid var(--hx-warning);
  padding-left: var(--hx-space-3);
}

.activity-timeline-section-header {
  align-items: flex-start;
  display: flex;
  gap: var(--hx-space-3);
  justify-content: space-between;
  margin-bottom: var(--hx-space-4);
}

.activity-timeline-section-header h3 {
  font-size: var(--hx-text-md);
}

.activity-timeline-section-header p {
  color: var(--hx-text-muted);
  font-size: var(--hx-text-sm);
  margin: var(--hx-space-1) 0 0;
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
  gap: var(--hx-space-2);
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
  gap: var(--hx-space-3);
  margin-bottom: var(--hx-space-2);
}

.activity-timeline-meta time {
  margin-left: auto;
  color: var(--hx-text-faint);
  font-size: var(--hx-text-sm);
  white-space: nowrap;
}

.activity-timeline-entry h4 {
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

@media (max-width: 640px) {
  .activity-feed-header {
    align-items: stretch;
    flex-direction: column;
  }

  .activity-feed-actions {
    justify-content: flex-start;
  }

  .activity-feed-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .activity-filter-field {
    align-items: stretch;
    flex-direction: column;
  }

  .activity-filter-select {
    width: 100%;
  }

  .activity-timeline-meta {
    align-items: center;
  }
}
</style>
