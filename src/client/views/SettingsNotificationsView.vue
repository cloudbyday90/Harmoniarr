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
  <div class="panel-light">
    <div class="section-header">
      <h2>Push Notifications</h2>
    </div>
    
    <div v-if="!isSupported" class="muted-copy">
      Push notifications are not supported in this browser.
    </div>

    <div v-else>
      <div v-if="errorMessage" class="hx-callout hx-callout-error">
        {{ errorMessage }}
      </div>

      <div class="hx-form-row">
        <div class="hx-form-field">
          <label>Browser Notifications</label>
          <p class="muted-copy text-sm">
            Receive push notifications when your requested music is fulfilled.
          </p>
        </div>

        <div class="hx-form-field">
          <div v-if="permissionState === 'denied'" class="muted-copy text-sm">
            Notifications are blocked by your browser. Please update your browser settings to allow them.
          </div>
          <div v-else-if="isSubscribed">
            <button
              type="button"
              class="hx-btn"
              :disabled="isLoading"
              @click="unsubscribe"
            >
              <span v-if="isLoading">Unsubscribing...</span>
              <span v-else>Unsubscribe</span>
            </button>
            <p class="muted-copy text-sm mt-2">
              This browser is currently subscribed to notifications.
            </p>
          </div>
          <div v-else>
            <button
              type="button"
              class="hx-btn hx-btn-primary"
              :disabled="isLoading"
              @click="subscribe"
            >
              <span v-if="isLoading">Subscribing...</span>
              <span v-else>Enable Notifications</span>
            </button>
            <p class="muted-copy text-sm mt-2">
              This browser is not subscribed.
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
