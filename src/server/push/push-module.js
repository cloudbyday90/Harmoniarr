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

import { createPushNotificationService } from './push-notification-service.js';
import { createPushSubscriptionStore } from './push-subscription-store.js';

/**
 * Push module factory. Wires together the subscription store and notification
 * service and exposes route dependencies.
 *
 * @param {object} [options]
 * @param {object} [options.pushSubscriptionStore]
 * @param {object} [options.pushNotificationService]
 * @returns {{ pushSubscriptionStore, pushNotificationService, routeDependencies }}
 */
export function createPushModule({
  pushSubscriptionStore = createPushSubscriptionStore(),
  pushNotificationService = createPushNotificationService({ pushSubscriptionStore }),
} = {}) {
  return {
    pushSubscriptionStore,
    pushNotificationService,
    routeDependencies: {
      getVapidPublicKey: pushNotificationService.getVapidPublicKey,
      subscribe: pushNotificationService.subscribe,
      unsubscribe: pushNotificationService.unsubscribe,
    },
  };
}
