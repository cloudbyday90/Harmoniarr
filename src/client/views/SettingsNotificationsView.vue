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
import { onMounted } from 'vue';
import { usePushNotifications } from '../composables/usePushNotifications.js';
import { useNotificationCategories } from '../composables/useNotificationCategories.js';

const {
  isSupported,
  permissionState,
  isSubscribed,
  isLoading: isPushLoading,
  errorMessage: pushError,
  subscribe,
  unsubscribe,
  checkSubscriptionStatus,
} = usePushNotifications();

const {
  errorMessage: prefsError,
  getEffectiveValue,
  isPending,
  isLoading: isPrefsLoading,
  loadPreferences,
  toggleCategory,
  visibleCategories,
} = useNotificationCategories();

onMounted(() => {
  checkSubscriptionStatus();
  loadPreferences();
});
</script>

<template>
  <div class="cfg-page">
    <article class="hx-card">
      <header class="hx-card-header">
        <div>
          <h3 class="hx-card-title">Browser notifications</h3>
          <p class="hx-card-subtitle">Get notified in this browser when your requested music is ready to download.</p>
        </div>
      </header>
      <div class="hx-card-body">

        <div v-if="!isSupported" class="hx-empty">
          <p class="hx-empty-title">Not supported</p>
          <p class="hx-empty-copy">Push notifications are not available in this browser.</p>
        </div>

        <template v-else>
          <div v-if="pushError" class="hx-callout hx-callout-error" style="margin-bottom: var(--hx-space-3)">
            {{ pushError }}
          </div>

          <div class="cfg-group" style="padding-top: 0; border-top: none">
            <div v-if="permissionState === 'denied'">
              <p class="hx-text-muted">Notifications are blocked by your browser. Open your browser's site settings and allow notifications for this page, then reload.</p>
            </div>

            <div v-else-if="isSubscribed">
              <p class="hx-text-muted" style="margin-bottom: var(--hx-space-3)">This browser is subscribed. You will receive a notification when your requested music is fulfilled.</p>
              <button
                type="button"
                class="hx-btn"
                :disabled="isPushLoading"
                @click="unsubscribe"
              >
                {{ isPushLoading ? 'Unsubscribing…' : 'Unsubscribe' }}
              </button>
            </div>

            <div v-else>
              <p class="hx-text-muted" style="margin-bottom: var(--hx-space-3)">Subscribe to receive a notification when your requested music is ready to download.</p>
              <button
                type="button"
                class="hx-btn"
                data-variant="primary"
                :disabled="isPushLoading"
                @click="subscribe"
              >
                {{ isPushLoading ? 'Subscribing…' : 'Enable notifications' }}
              </button>
            </div>
          </div>
        </template>

      </div>
    </article>

    <article class="hx-card" style="margin-top: var(--hx-space-4)">
      <header class="hx-card-header">
        <div>
          <h3 class="hx-card-title">Notification categories</h3>
          <p class="hx-card-subtitle">Choose which events trigger push notifications.</p>
        </div>
      </header>
      <div class="hx-card-body">
        <div v-if="prefsError" class="hx-callout hx-callout-error" style="margin-bottom: var(--hx-space-3)">
          {{ prefsError }}
        </div>

        <div class="sn-categories">
          <label
            v-for="category in visibleCategories"
            :key="category.key"
            class="cfg-check sn-category"
          >
            <input
              type="checkbox"
              :checked="getEffectiveValue(category.key)"
              :disabled="isPending(category.key) || isPrefsLoading"
              @change="toggleCategory(category.key)"
            />
            <span>
              <span class="sn-category-label">{{ category.label }}</span>
              <span class="sn-category-desc">{{ category.description }}</span>
            </span>
          </label>
        </div>
      </div>
    </article>
  </div>
</template>

<style scoped>
.sn-categories {
  display: flex;
  flex-direction: column;
  gap: var(--hx-space-2);
}

.sn-category span {
  display: flex;
  flex-direction: column;
  gap: var(--hx-space-1);
}

.sn-category-label {
  font-weight: 500;
}

.sn-category-desc {
  font-size: var(--hx-text-xs);
  color: var(--hx-text-muted);
}
</style>
