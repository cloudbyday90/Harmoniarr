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

const {
  isSupported,
  permissionState,
  isSubscribed,
  isLoading,
  errorMessage,
  subscribe,
  unsubscribe,
  checkSubscriptionStatus,
} = usePushNotifications();

onMounted(() => {
  checkSubscriptionStatus();
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
          <div v-if="errorMessage" class="hx-callout hx-callout-error" style="margin-bottom: var(--hx-space-3)">
            {{ errorMessage }}
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
                :disabled="isLoading"
                @click="unsubscribe"
              >
                {{ isLoading ? 'Unsubscribing…' : 'Unsubscribe' }}
              </button>
            </div>

            <div v-else>
              <p class="hx-text-muted" style="margin-bottom: var(--hx-space-3)">Subscribe to receive a notification when your requested music is ready to download.</p>
              <button
                type="button"
                class="hx-btn"
                data-variant="primary"
                :disabled="isLoading"
                @click="subscribe"
              >
                {{ isLoading ? 'Subscribing…' : 'Enable notifications' }}
              </button>
            </div>
          </div>
        </template>

      </div>
    </article>
  </div>
</template>
