/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { computed, readonly, ref } from 'vue';
import { fetchVapidPublicKey, subscribeToPush, unsubscribeFromPush } from '../lib/push-api.js';
import { urlBase64ToUint8Array } from '../lib/push-encoding.js';

/**
 * Vue composable for Web Push subscription lifecycle.
 *
 * Manages permission requests, subscription registration, and server sync.
 * Shares state across all component instances (module-level refs) — there is
 * at most one active push subscription per browser page.
 *
 * All browser globals (Notification, navigator, PushManager) are injectable
 * for unit-test isolation.
 *
 * @param {object} [opts]
 * @param {object}   [opts.notificationApi]     - Injectable Notification API object.
 * @param {object}   [opts.navigatorApi]        - Injectable navigator object.
 * @param {function} [opts.fetchVapidPublicKeyFn] - Injectable API call.
 * @param {function} [opts.subscribeToPushFn]   - Injectable API call.
 * @param {function} [opts.unsubscribeFromPushFn] - Injectable API call.
 * @returns {{ isSupported, permissionState, isSubscribed, isLoading, errorMessage, subscribe, unsubscribe, checkSubscriptionStatus }}
 */

// ── Module-level shared state ─────────────────────────────────────────────────

/**
 * Permission state: 'default' | 'granted' | 'denied' | 'unsupported'
 * Mirrors Notification.permission, extended with 'unsupported' for browsers
 * that lack PushManager.
 */
const _permissionState = ref('default');

/** True when this browser device has an active server-registered subscription. */
const _isSubscribed = ref(false);

/** True while an async subscribe/unsubscribe operation is in flight. */
const _isLoading = ref(false);

/** Last subscribe/unsubscribe error message, or null when no error. */
const _errorMessage = ref(null);

// ── Composable ────────────────────────────────────────────────────────────────

export function usePushNotifications({
  notificationApi = typeof Notification !== 'undefined' ? Notification : null,
  navigatorApi = typeof navigator !== 'undefined' ? navigator : null,
  fetchVapidPublicKeyFn = fetchVapidPublicKey,
  subscribeToPushFn = subscribeToPush,
  unsubscribeFromPushFn = unsubscribeFromPush,
} = {}) {
  const isSupported = computed(() => {
    return Boolean(
      navigatorApi?.serviceWorker
        && navigatorApi?.serviceWorker?.getRegistration
        && notificationApi
        && typeof notificationApi.requestPermission === 'function'
        && typeof PushManager !== 'undefined',
    );
  });

  // Sync permission state from browser API on each call, unless unsupported.
  if (notificationApi && isSupported.value) {
    const browserPermission = notificationApi.permission ?? 'default';
    if (_permissionState.value !== 'unsupported') {
      _permissionState.value = browserPermission;
    }
  } else if (!isSupported.value) {
    _permissionState.value = 'unsupported';
  }

  /**
   * Read the current push subscription state from the browser without any
   * network request. Sets `_isSubscribed` based on whether a subscription
   * already exists in the browser's push manager.
   */
  async function checkSubscriptionStatus() {
    if (!isSupported.value) {
      _isSubscribed.value = false;
      return;
    }

    try {
      const registration = await navigatorApi.serviceWorker.getRegistration('/service-worker.js');
      if (!registration?.pushManager) {
        _isSubscribed.value = false;
        return;
      }

      const existing = await registration.pushManager.getSubscription();
      _isSubscribed.value = Boolean(existing);
    } catch {
      _isSubscribed.value = false;
    }

  }

  /**
   * Request notification permission (if not yet granted), subscribe via the
   * browser push API, and register the subscription with the server.
   */
  async function subscribe() {
    if (!isSupported.value) return;
    if (_permissionState.value === 'denied') return;
    if (_isSubscribed.value) return;

    _isLoading.value = true;
    _errorMessage.value = null;

    try {
      // 1. Request permission.
      const permission = await notificationApi.requestPermission();
      _permissionState.value = permission;
      if (permission !== 'granted') {
        return;
      }

      // 2. Get the VAPID public key from the server.
      const { vapidPublicKey } = await fetchVapidPublicKeyFn();
      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

      // 3. Get the active SW registration.
      const registration = await navigatorApi.serviceWorker.getRegistration('/service-worker.js');
      if (!registration?.pushManager) {
        throw new Error('Service worker registration not found or pushManager unavailable.');
      }

      // 4. Subscribe via the browser push API.
      const subscription = await registration.pushManager.subscribe({
        applicationServerKey,
        userVisibleOnly: true,
      });

      const subscriptionJson = subscription.toJSON();
      const { endpoint, keys } = subscriptionJson;

      // 5. Register subscription with the server.
      await subscribeToPushFn({
        endpoint,
        keys: {
          auth: keys.auth,
          p256dh: keys.p256dh,
        },
        userAgent: navigatorApi.userAgent ?? null,
      });

      _isSubscribed.value = true;
    } catch (err) {
      _errorMessage.value = err?.message ?? 'Failed to enable push notifications.';
    } finally {
      _isLoading.value = false;
    }
  }

  /**
   * Unsubscribe from the browser push API and remove the subscription from
   * the server.
   */
  async function unsubscribe() {
    if (!isSupported.value) return;
    if (!_isSubscribed.value) return;

    _isLoading.value = true;
    _errorMessage.value = null;

    try {
      const registration = await navigatorApi.serviceWorker.getRegistration('/service-worker.js');
      const subscription = registration?.pushManager
        ? await registration.pushManager.getSubscription()
        : null;

      if (subscription) {
        const { endpoint } = subscription;
        await subscription.unsubscribe();
        // Best-effort server removal — don't throw if it fails.
        await unsubscribeFromPushFn({ endpoint }).catch(() => {});
      }

      _isSubscribed.value = false;
    } catch (err) {
      _errorMessage.value = err?.message ?? 'Failed to disable push notifications.';
    } finally {
      _isLoading.value = false;
    }
  }

  return {
    /** True if this browser supports push notifications. */
    isSupported: readonly(isSupported),
    /** Browser notification permission: 'default' | 'granted' | 'denied' | 'unsupported'. */
    permissionState: readonly(_permissionState),
    /** True when a push subscription is active on this device. */
    isSubscribed: readonly(_isSubscribed),
    /** True while subscribe/unsubscribe is in progress. */
    isLoading: readonly(_isLoading),
    /** Last error message from subscribe/unsubscribe, or null. */
    errorMessage: readonly(_errorMessage),
    /** Subscribe to push notifications. No-op if unsupported or already subscribed. */
    subscribe,
    /** Unsubscribe from push notifications. No-op if unsupported or not subscribed. */
    unsubscribe,
    /** Refresh subscription status from the browser. Call this from onMounted. */
    checkSubscriptionStatus,
  };
}

/**
 * Reset module-level state. Exported only for use in test suites.
 * Do not call in application code.
 */
export function _resetPushNotificationsState() {
  _permissionState.value = 'default';
  _isSubscribed.value = false;
  _isLoading.value = false;
  _errorMessage.value = null;
}
