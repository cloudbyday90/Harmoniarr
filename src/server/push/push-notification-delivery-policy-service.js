/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { appUserRoleOptions } from '../app-user-permission-service.js';
import { NOTIFICATION_CATEGORIES } from '../notification/notification-preference-constants.js';
import { getNotificationPreferenceDecision } from '../notification/notification-preference-service.js';
import { createPushNotificationDeliveryPolicyStore } from './push-notification-delivery-policy-store.js';

const deny = (reason, retryable = false) => ({ allowed: false, retryable, reason });

/** Delivery authorization is read afresh for every claimed row, including retries. */
export function createPushNotificationDeliveryPolicyService({
  pushNotificationDeliveryPolicyStore = createPushNotificationDeliveryPolicyStore(),
} = {}) {
  async function getDeliveryDecision({ userId, eventType }) {
    if (typeof eventType !== 'string' || !Object.hasOwn(NOTIFICATION_CATEGORIES, eventType)) {
      return deny('unknown_category');
    }
    if (typeof userId !== 'string' || userId.length === 0) return deny('missing_account');
    try {
      const account = await pushNotificationDeliveryPolicyStore.getDeliveryAccount({ userId });
      if (!account || account.id !== userId) return deny('missing_account');
      if (account.isDisabled === true) return deny('disabled_account');
      if (account.isDisabled !== false) return deny('account_unavailable', true);
      if (!appUserRoleOptions.includes(account.role)) return deny('ineligible_role');
      if (NOTIFICATION_CATEGORIES[eventType].adminOnly && account.role !== 'admin') {
        return deny('ineligible_role');
      }
      const preference = await getNotificationPreferenceDecision({ category: eventType, userId,
        getUserPreferences: async () => account.userPreferences });
      if (preference.failed) return deny('preferences_unavailable', true);
      return preference.allowed
        ? { allowed: true, retryable: false, reason: 'enabled' }
        : deny('preference_disabled');
    } catch {
      // Neither database messages nor preference contents belong in delivery logs.
      return deny('account_unavailable', true);
    }
  }
  return { getDeliveryDecision };
}
