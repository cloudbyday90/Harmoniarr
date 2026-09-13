/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { isDeepStrictEqual } from 'node:util';

export const candidateNotificationColumns = Object.freeze([
  { tableName: 'user_push_subscriptions', name: 'registration_token', dataType: 'uuid', isNullable: false, defaultExpression: 'harmoniarr_generate_uuid()' },
  { tableName: 'notification_queue', name: 'claim_token', dataType: 'uuid', isNullable: true, defaultExpression: null },
  { tableName: 'notification_queue', name: 'expires_at', dataType: 'timestamp with time zone', isNullable: false, defaultExpression: null },
  { tableName: 'notification_queue', name: 'terminal_at', dataType: 'timestamp with time zone', isNullable: true, defaultExpression: null },
]);
export const candidateNotificationConstraints = Object.freeze([
  { tableName: 'notification_queue', name: 'notification_queue_claim_pending_check', type: 'c', validated: true, deferrable: false,
    definition: "CHECK (((claim_token IS NULL) OR (status = 'pending'::text)))" },
  { tableName: 'notification_queue', name: 'notification_queue_terminal_state_check', type: 'c', validated: true, deferrable: false,
    definition: "CHECK ((((status = 'pending'::text) AND (terminal_at IS NULL)) OR ((status = ANY (ARRAY['sent'::text, 'failed'::text, 'expired'::text])) AND (terminal_at IS NOT NULL) AND isfinite(terminal_at))))" },
  { tableName: 'notification_queue', name: 'notification_queue_subscription_id_fkey', type: 'f', validated: true, deferrable: false,
    definition: 'FOREIGN KEY (subscription_id) REFERENCES user_push_subscriptions(id) ON DELETE CASCADE' },
]);

const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const hash = /^[a-f0-9]{64}$/;
const states = ['pending', 'sent', 'failed', 'expired'];
const finiteDate = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value));
function check(value) { if (!value) throw new Error('Packaged notification continuity contract was not satisfied'); }
function preserved(before, after) {
  for (const [key, value] of Object.entries(before)) check(isDeepStrictEqual(after[key], value));
}

/** Validate captured database state locally; outward acceptance evidence contains only counts and booleans. */
export function verifyNotificationContinuity({ probe, previous, fixture, requireCurrent }) {
  const state = probe.notificationContinuity;
  const before = previous?.notificationContinuity;
  check(state && finiteDate(state.observedAt) && state.columns && state.subscription && Array.isArray(state.notifications));
  const columns = ['registrationToken', 'claimToken', 'expiresAt', 'terminalAt'];
  check(columns.every((key) => typeof state.columns[key] === 'boolean'));
  const current = columns.every((key) => state.columns[key]);
  check(!requireCurrent || current);
  if (current) {
    const schema = probe.notificationSchema;
    for (const [kind, expected] of [['columns', candidateNotificationColumns], ['constraints', candidateNotificationConstraints]]) {
      check(Array.isArray(schema?.[kind]) && schema[kind].length <= 100);
      for (const entry of expected) {
        const matches = schema[kind].filter((row) => row.tableName === entry.tableName && row.name === entry.name);
        check(matches.length === 1);
        for (const [key, value] of Object.entries(entry)) check(matches[0][key] === value);
      }
    }
  }
  const subscription = state.subscription;
  check(subscription.id === fixture.subscriptionId && subscription.user_id === fixture.userId
    && [subscription.endpoint_hash, subscription.p256dh_hash, subscription.auth_hash].every((value) => hash.test(value))
    && finiteDate(subscription.created_at) && finiteDate(subscription.invalidated_at));
  check(Object.hasOwn(subscription, 'registration_token') === state.columns.registrationToken);
  if (state.columns.registrationToken) check(uuid.test(subscription.registration_token));
  check(state.notifications.length === states.length && new Set(state.notifications.map((row) => row.id)).size === states.length);
  for (const status of states) {
    const row = state.notifications.find((entry) => entry.id === fixture.notificationIds[status]);
    check(row && row.status === status && row.user_id === fixture.userId && row.subscription_id === fixture.subscriptionId
      && row.event_type === 'releaseAdded' && hash.test(row.payload_hash) && Number.isSafeInteger(row.ttl_seconds)
      && row.ttl_seconds > 0 && row.attempts === 0 && finiteDate(row.created_at) && finiteDate(row.next_attempt_at)
      && finiteDate(row.expected_expires_at));
    check(status === 'sent' ? finiteDate(row.sent_at) : row.sent_at === null);
    if (status === 'pending') check(Date.parse(row.next_attempt_at) > Date.parse(state.observedAt));
    for (const [flag, field] of [['claimToken', 'claim_token'], ['expiresAt', 'expires_at'], ['terminalAt', 'terminal_at']]) {
      check(Object.hasOwn(row, field) === state.columns[flag]);
    }
    if (state.columns.claimToken) check(row.claim_token === null);
    if (state.columns.expiresAt) check(finiteDate(row.expires_at) && row.expires_at === row.expected_expires_at);
    if (state.columns.terminalAt) {
      check(status === 'pending' ? row.terminal_at === null : finiteDate(row.terminal_at));
      if (status === 'sent') check(row.terminal_at === row.sent_at);
      if (status !== 'pending') check(Date.parse(row.terminal_at) <= Date.parse(state.observedAt));
    }
    if (before) {
      const old = before.notifications.find((entry) => entry.id === row.id);
      check(old);
      preserved(old, row);
      if (!before.columns.expiresAt && state.columns.expiresAt) check(row.expires_at === row.expected_expires_at);
      if (!before.columns.terminalAt && state.columns.terminalAt && status !== 'pending') {
        if (status === 'sent') check(row.terminal_at === row.sent_at);
        else check(Date.parse(row.terminal_at) >= Date.parse(before.observedAt) && Date.parse(row.terminal_at) <= Date.parse(state.observedAt));
      }
    }
  }
  if (before) {
    check(Date.parse(state.observedAt) >= Date.parse(before.observedAt));
    for (const key of columns) check(!before.columns[key] || state.columns[key]);
    preserved(before.subscription, subscription);
    if (!before.columns.terminalAt && state.columns.terminalAt) {
      const unknown = state.notifications.filter((row) => ['failed', 'expired'].includes(row.status));
      check(unknown[0].terminal_at === unknown[1].terminal_at);
    }
  }
  return current;
}
