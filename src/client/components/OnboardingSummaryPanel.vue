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
import { RouterLink } from 'vue-router';
import { computed, useId } from 'vue';
import {
  buildOnboardingRefreshMessage,
  formatMetaLabel,
  formatMetaValue,
  getStepStatusClass,
  getStepStatusLabel,
} from '../lib/onboarding-presentation.js';

const props = defineProps({
  errorMessage: {
    type: String,
    default: '',
  },
  isLoading: {
    type: Boolean,
    default: false,
  },
  isRevalidating: {
    type: Boolean,
    default: false,
  },
  isSetupMode: {
    type: Boolean,
    default: false,
  },
  nextAction: {
    type: Object,
    default: null,
  },
  steps: {
    type: Array,
    default: () => [],
  },
  summary: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits(['dismiss', 'refresh']);
const resultsId = `onboarding-results-${useId()}`;
const isBusy = computed(() => props.isLoading || props.isRevalidating);
const refreshMessage = computed(() => buildOnboardingRefreshMessage(props));
</script>

<template>
  <article class="hx-card onboarding-panel">
    <header class="hx-card-header">
      <div>
        <h3 class="hx-card-title">{{ isSetupMode ? 'Complete your setup' : 'Setup status' }}</h3>
        <p class="hx-card-subtitle" v-if="summary">{{ summary.message }}</p>
      </div>
      <div class="onboarding-panel-actions">
        <button type="button" class="review-reset-button" :aria-controls="resultsId" :aria-disabled="isBusy ? 'true' : undefined" @click="!isBusy && emit('refresh')">Refresh</button>
        <button v-if="isSetupMode" type="button" class="review-reset-button" @click="emit('dismiss')">Hide setup mode</button>
      </div>
    </header>

    <p class="onboarding-refresh-status" role="status" aria-live="polite" aria-atomic="true">{{ refreshMessage }}</p>
    <div :id="resultsId" class="onboarding-panel-results" :aria-busy="isBusy ? 'true' : 'false'">
      <article class="error-panel panel-light" v-if="errorMessage">
        <h3>{{ summary ? 'Setup refresh unavailable' : 'Setup status unavailable' }}</h3>
        <p>{{ refreshMessage }}</p>
      </article>

      <template v-if="summary">
        <div class="pill-row onboarding-pill-row">
          <div class="pill">
            <span>Ready steps</span>
            <strong>{{ summary.completeStepCount }} / {{ summary.totalStepCount }}</strong>
          </div>
          <div class="pill">
            <span>Open issues</span>
            <strong>{{ summary.issueCount }}</strong>
          </div>
        </div>

        <div class="onboarding-step-stack">
          <article class="onboarding-step-card" v-for="step in steps" :key="step.id">
            <div class="review-detail-header">
              <div>
                <p>{{ step.title }}</p>
                <strong>{{ step.message }}</strong>
              </div>
              <span class="review-status-pill" :class="getStepStatusClass(step.status)">
                {{ getStepStatusLabel(step.status) }}
              </span>
            </div>
            <dl class="review-meta-grid onboarding-meta-grid" v-if="step.meta">
              <div v-for="[key, value] in Object.entries(step.meta)" :key="key">
                <dt>{{ formatMetaLabel(key) }}</dt>
                <dd>{{ formatMetaValue(value) }}</dd>
              </div>
            </dl>
            <RouterLink
              v-if="step.action"
              :to="step.action.to"
              class="onboarding-action-link"
            >
              {{ step.action.label }}
            </RouterLink>
          </article>
        </div>

        <RouterLink
          v-if="nextAction"
          :to="nextAction.to"
          class="onboarding-primary-link"
        >
          {{ nextAction.label }}
        </RouterLink>
      </template>
    </div>
  </article>
</template>

<style scoped>
.onboarding-refresh-status { margin: 0; color: var(--hx-text-muted); font-size: var(--hx-text-sm); }
.onboarding-panel-results { display: grid; gap: var(--hx-space-4); min-width: 0; }
.review-reset-button[aria-disabled='true'] { cursor: progress; opacity: 0.65; }
</style>
