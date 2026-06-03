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
import { computed, onMounted, reactive, ref } from 'vue';
import { useSourceUserIgnore } from '../composables/useSourceUserIgnore.js';
import { fetchSettings, updateSettings } from '../lib/settings-api.js';
import { getErrorMessage } from '../lib/error-utils.js';
import {
  filterIgnoredSourceUsers,
  formatIgnoreActor,
  formatIgnoreReason,
  formatIgnoreSource,
  formatIgnoredAt,
  formatIgnoredUserCountLabel,
  formatSourceUsername,
  formatSuggestionReason,
  formatSuggestionSignals,
} from '../lib/source-user-ignore-presentation.js';

const ignoreForm = reactive({
  reason: '',
  username: '',
});
const filterQuery = ref('');

const autoApply = reactive({
  cooldownHours: 24,
  enabled: false,
});
const autoApplyErrorMessage = ref('');
const isLoadingAutoApply = ref(false);
const isSavingAutoApply = ref(false);

const {
  actionErrorMessage,
  applyIgnore,
  errorMessage,
  ignoredCount,
  ignoredSourceUsers,
  isApplying,
  isLoading,
  isRemoving,
  load,
  pendingUsername,
  removeIgnore,
  suggestionCount,
  suggestions,
} = useSourceUserIgnore();

const visibleEntries = computed(() => filterIgnoredSourceUsers(ignoredSourceUsers.value, filterQuery.value));

async function handleRefresh() {
  await Promise.all([load(), loadAutoApply()]);
}

async function loadAutoApply() {
  isLoadingAutoApply.value = true;
  autoApplyErrorMessage.value = '';

  try {
    const payload = await fetchSettings();
    const acquisition = payload?.settings?.acquisition ?? {};
    autoApply.enabled = acquisition.autoIgnoreEnabled === true;
    autoApply.cooldownHours = Number.isFinite(Number(acquisition.autoIgnoreCooldownHours))
      ? Number(acquisition.autoIgnoreCooldownHours)
      : 24;
  } catch (error) {
    autoApplyErrorMessage.value = getErrorMessage(error, 'Failed to load auto-ignore settings');
  } finally {
    isLoadingAutoApply.value = false;
  }
}

async function handleSaveAutoApply() {
  isSavingAutoApply.value = true;
  autoApplyErrorMessage.value = '';

  try {
    await updateSettings({
      acquisition: {
        autoIgnoreCooldownHours: Number(autoApply.cooldownHours),
        autoIgnoreEnabled: autoApply.enabled === true,
      },
    });
    await loadAutoApply();
  } catch (error) {
    autoApplyErrorMessage.value = getErrorMessage(error, 'Failed to save auto-ignore settings');
  } finally {
    isSavingAutoApply.value = false;
  }
}

async function handleSubmit() {
  const didApply = await applyIgnore({
    reason: ignoreForm.reason,
    username: ignoreForm.username,
  });

  if (!didApply) {
    return;
  }

  ignoreForm.reason = '';
  ignoreForm.username = '';
}

async function handleApplySuggestion(suggestion) {
  await applyIgnore({
    reason: suggestion?.suggestion?.reason,
    suggestionSignals: suggestion?.suggestion?.signals,
    username: suggestion?.username,
  });
}

async function handleRemove(username) {
  await removeIgnore(username);
}

onMounted(() => {
  void load();
  void loadAutoApply();
});
</script>

<template>
  <section>
    <header class="hx-page-header">
      <div>
        <h2 class="hx-page-title">Ignored source users</h2>
        <p class="hx-page-subtitle">
          {{ formatIgnoredUserCountLabel(ignoredCount) }}.
          Ignored peers are skipped during acquisition while remaining visible for operator review.
        </p>
      </div>
      <div class="hx-page-actions">
        <button type="button" class="hx-btn" @click="handleRefresh" :disabled="isLoading">
          {{ isLoading ? 'Refreshing…' : 'Refresh' }}
        </button>
      </div>
    </header>

    <div class="hx-stat-grid" style="margin-bottom: var(--hx-space-4)">
      <div class="hx-stat">
        <span class="hx-stat-label">IGNORED USERS</span>
        <span class="hx-stat-value">{{ ignoredCount }}</span>
        <span class="hx-stat-meta">Currently skipped during acquisition</span>
      </div>
      <div class="hx-stat">
        <span class="hx-stat-label">SUGGESTIONS</span>
        <span class="hx-stat-value">{{ suggestionCount }}</span>
        <span class="hx-stat-meta">Reputation-flagged for review</span>
      </div>
      <div class="hx-stat">
        <span class="hx-stat-label">AUTO-APPLY</span>
        <span class="hx-stat-value" style="font-size: var(--hx-text-sm)">{{ autoApply.enabled ? 'Enabled' : 'Disabled' }}</span>
        <span class="hx-stat-meta">{{ autoApply.cooldownHours }}h cooldown</span>
      </div>
    </div>

    <article class="hx-card" style="margin-bottom: var(--hx-space-4)">
      <header class="hx-card-header">
        <div>
          <h3 class="hx-card-title">Suggested to ignore</h3>
          <p class="hx-card-subtitle">
            Peers with repeated low-quality deliveries. Apply with one click to skip them during acquisition.
          </p>
        </div>
      </header>

      <div class="hx-card-body is-flush">
        <div v-if="!suggestions.length" class="hx-empty">
          <p class="hx-empty-title">No suggestions right now</p>
          <p class="hx-empty-copy">When a peer accumulates failed or degraded deliveries, it will surface here.</p>
        </div>

        <div v-else class="hx-table-scroll">
          <table class="hx-table" aria-label="Suggested source users to ignore">
            <thead>
              <tr>
                <th>Username</th>
                <th>Trust</th>
                <th>Failures</th>
                <th>Reason</th>
                <th>Signals</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="suggestion in suggestions" :key="suggestion.username">
                <td><strong>{{ formatSourceUsername(suggestion.username) }}</strong></td>
                <td><span class="hx-pill" data-tone="warning">{{ suggestion.trustState || 'unknown' }}</span></td>
                <td>{{ suggestion.failureCount ?? 0 }}</td>
                <td>{{ formatSuggestionReason(suggestion.suggestion?.reason) }}</td>
                <td>{{ formatSuggestionSignals(suggestion.suggestion?.signals) }}</td>
                <td>
                  <button
                    type="button"
                    class="hx-btn"
                    data-variant="primary"
                    :disabled="isApplying && pendingUsername === suggestion.username"
                    @click="handleApplySuggestion(suggestion)"
                  >
                    {{ isApplying && pendingUsername === suggestion.username ? 'Ignoring…' : 'Ignore' }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </article>

    <div class="cfg-2col">
      <div>
        <article class="hx-card" style="margin-bottom: var(--hx-space-4)">
          <header class="hx-card-header">
            <div>
              <h3 class="hx-card-title">Ignore source user</h3>
              <p class="hx-card-subtitle">Manually add a peer to the ignore list with an explicit reason.</p>
            </div>
          </header>

          <form class="hx-card-body" @submit.prevent="handleSubmit">
            <div class="hx-form-row">
              <div class="hx-field">
                <label class="hx-field-label" for="ignore-username">Soulseek username</label>
                <input
                  id="ignore-username"
                  v-model="ignoreForm.username"
                  class="hx-input"
                  type="text"
                  autocomplete="off"
                  spellcheck="false"
                />
              </div>
            </div>

            <div class="hx-form-row">
              <div class="hx-field">
                <label class="hx-field-label" for="ignore-reason">Ignore reason</label>
                <input
                  id="ignore-reason"
                  v-model="ignoreForm.reason"
                  class="hx-input"
                  type="text"
                  autocomplete="off"
                  spellcheck="false"
                />
              </div>
            </div>

            <p v-if="actionErrorMessage" class="hx-text-sm" style="color: var(--hx-danger)">{{ actionErrorMessage }}</p>

            <div class="hx-card-actions">
              <button
                type="submit"
                class="hx-btn"
                data-variant="primary"
                :disabled="isApplying"
              >
                {{ isApplying ? 'Saving…' : 'Ignore user' }}
              </button>
            </div>
          </form>
        </article>

        <article class="hx-card">
          <header class="hx-card-header">
            <div>
              <h3 class="hx-card-title">Auto-apply</h3>
              <p class="hx-card-subtitle">Automatically ignore peers once the reputation heuristic flags them.</p>
            </div>
          </header>

          <form class="hx-card-body" @submit.prevent="handleSaveAutoApply">
            <div class="hx-form-row">
              <label class="hx-field" style="flex-direction: row; align-items: center; gap: var(--hx-space-2)">
                <input
                  v-model="autoApply.enabled"
                  type="checkbox"
                  :disabled="isLoadingAutoApply || isSavingAutoApply"
                />
                <span class="hx-field-label" style="margin: 0">Enable automatic ignore</span>
              </label>
            </div>

            <div class="hx-form-row">
              <div class="hx-field">
                <label class="hx-field-label" for="auto-ignore-cooldown">Cooldown (hours)</label>
                <input
                  id="auto-ignore-cooldown"
                  v-model.number="autoApply.cooldownHours"
                  class="hx-input"
                  type="number"
                  min="0"
                  max="8760"
                  :disabled="isLoadingAutoApply || isSavingAutoApply"
                />
              </div>
            </div>

            <p v-if="autoApplyErrorMessage" class="hx-text-sm" style="color: var(--hx-danger)">{{ autoApplyErrorMessage }}</p>

            <div class="hx-card-actions">
              <button
                type="submit"
                class="hx-btn"
                data-variant="primary"
                :disabled="isLoadingAutoApply || isSavingAutoApply"
              >
                {{ isSavingAutoApply ? 'Saving…' : 'Save auto-apply' }}
              </button>
            </div>
          </form>
        </article>
      </div>

      <article class="hx-card">
        <header class="hx-card-header">
          <div>
            <h3 class="hx-card-title">Ignore list</h3>
            <p class="hx-card-subtitle">Reviewable list with explicit row actions for administrators.</p>
          </div>
        </header>

        <div class="hx-card-body is-flush">
          <div class="hx-card-body" role="search">
            <div class="hx-field">
              <label class="hx-field-label" for="ignore-filter">Filter ignored users</label>
              <input
                id="ignore-filter"
                v-model="filterQuery"
                class="hx-input"
                type="search"
                autocomplete="off"
                spellcheck="false"
              />
            </div>
          </div>

          <div v-if="errorMessage" class="hx-card-body">
            <span class="hx-pill" data-tone="danger">{{ errorMessage }}</span>
          </div>

          <div v-else-if="isLoading && !ignoredSourceUsers.length" class="hx-card-body">
            <div class="hx-skeleton-stack">
              <span class="hx-skeleton" data-size="lg"></span>
              <span class="hx-skeleton"></span>
              <span class="hx-skeleton"></span>
              <span class="hx-skeleton"></span>
            </div>
          </div>

          <div v-else-if="!ignoredSourceUsers.length" class="hx-empty">
            <p class="hx-empty-title">No ignored source users</p>
            <p class="hx-empty-copy">Ignored peers will appear here with the reason and provenance.</p>
          </div>

          <div v-else-if="!visibleEntries.length" class="hx-empty">
            <p class="hx-empty-title">No matches for this filter</p>
            <p class="hx-empty-copy">Clear the local filter to see all ignored users.</p>
          </div>

          <div v-else class="hx-table-scroll">
            <table class="hx-table" aria-label="Ignored source users">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Reason</th>
                  <th>Source</th>
                  <th>Ignored</th>
                  <th>By</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="entry in visibleEntries" :key="entry.username">
                  <td><strong>{{ formatSourceUsername(entry.username) }}</strong></td>
                  <td>{{ formatIgnoreReason(entry.reason) }}</td>
                  <td>
                    <span class="hx-pill" :data-tone="entry.source === 'auto' ? 'info' : 'neutral'">
                      {{ formatIgnoreSource(entry.source) }}
                    </span>
                  </td>
                  <td>{{ formatIgnoredAt(entry.createdAt) }}</td>
                  <td>{{ formatIgnoreActor(entry.actorUserId) }}</td>
                  <td>
                    <button
                      type="button"
                      class="hx-btn"
                      data-variant="ghost"
                      :disabled="isRemoving && pendingUsername === entry.username"
                      @click="handleRemove(entry.username)"
                    >
                      {{ isRemoving && pendingUsername === entry.username ? 'Removing…' : 'Remove' }}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>
