/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { runPackagedCandidateNotificationProbe } from '../../scripts/docker-candidate-notification-probe.js';
import { createPackagedCandidateSchemaProbeSource } from '../../scripts/docker-candidate-schema-probe.js';

const statuses = ['pending', 'sent', 'failed', 'expired'];
const id = (value) => `10000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
const fixture = { userId: id(1), subscriptionId: id(2), notificationIds: Object.fromEntries(statuses.map((status, index) => [status, id(index + 3)])) };
const timestamp = '2026-09-13 15:00:00.123456+00';
const future = '2027-09-13 15:00:00.123456+00';
const hash = (value) => createHash('sha256').update(value).digest('hex');
const core = {
  notification_queue: ['id', 'user_id', 'subscription_id', 'event_type', 'coalesce_key', 'payload', 'ttl_seconds', 'status', 'attempts', 'next_attempt_at', 'sent_at', 'created_at'],
  user_push_subscriptions: ['id', 'user_id', 'endpoint', 'p256dh', 'auth', 'user_agent', 'invalidated_at', 'created_at'],
};

function databaseFixture({ current = true, disabled = true } = {}) {
  const calls = [];
  const definitions = Object.entries(core).flatMap(([tableName, fields]) => fields.map((name) => ({ tableName, name })));
  if (current) definitions.push(
    { tableName: 'user_push_subscriptions', name: 'registration_token', dataType: 'uuid', isNullable: false, defaultExpression: 'harmoniarr_generate_uuid()' },
    { tableName: 'notification_queue', name: 'claim_token', dataType: 'uuid', isNullable: true, defaultExpression: null },
    ...['expires_at', 'terminal_at'].map((name) => ({ tableName: 'notification_queue', name, dataType: 'timestamp with time zone', isNullable: name !== 'expires_at', defaultExpression: null })),
  );
  const subscription = { id: fixture.subscriptionId, user_id: fixture.userId, user_agent: 'Packaged continuity fixture',
    invalidated_at: timestamp, created_at: timestamp, endpoint: 'https://push-fixture.invalid/private-capability',
    p256dh: 'synthetic-public-key', auth: 'synthetic-auth-secret', extra_private_data: 'must-not-return',
    ...(current ? { registration_token: id(9) } : {}) };
  const notifications = statuses.map((status) => ({ id: fixture.notificationIds[status], user_id: fixture.userId,
    subscription_id: fixture.subscriptionId, event_type: 'releaseAdded', coalesce_key: `fixture-${status}`,
    payload_text: `{"private-test-content":"${status}"}`, ttl_seconds: 31536000, status, attempts: 0,
    next_attempt_at: future, sent_at: status === 'sent' ? timestamp : null, created_at: timestamp, expected_expires_at: future,
    ...(current ? { claim_token: null, expires_at: future, terminal_at: status === 'pending' ? null : timestamp } : {}) }));
  const client = { query: async (sql, values) => {
    calls.push({ sql, values });
    if (sql.includes('FROM pg_attribute')) return { rows: definitions };
    if (sql.includes('FROM pg_constraint')) return { rows: [] };
    if (sql.startsWith('SELECT is_disabled')) return { rows: [{ is_disabled: disabled }] };
    if (sql.includes('INSERT INTO user_push_subscriptions') || sql.includes('INSERT INTO notification_queue')) return { rows: [], rowCount: 1 };
    if (sql.includes('FROM user_push_subscriptions WHERE')) return { rows: [subscription] };
    if (sql.includes('FROM notification_queue WHERE')) return { rows: notifications };
    if (sql.includes('AS "observedAt"')) return { rows: [{ observedAt: '2026-09-13 15:00:01.456789+00' }] };
    assert.fail('Unexpected fixture query');
  } };
  return { client, calls, definitions, subscription, notifications };
}

test('serialized notification probe executes as a standalone ESM module without host imports or database globals', async () => {
  const serialized = await import(`data:text/javascript,${encodeURIComponent(`export const probe = (${runPackagedCandidateNotificationProbe.toString()});`)}`);
  const database = databaseFixture();
  const result = await serialized.probe({ client: database.client, fixture, seed: false });
  assert.equal(result.notificationContinuity.notifications.length, 4);
  assert.equal(result.notificationSchema.columns.length, 4);
  assert.match(createPackagedCandidateSchemaProbeSource(), /import\('\/app\/server-dist\/migration-manifest\.js'\)/);
  assert.match(createPackagedCandidateSchemaProbeSource(), /JSON\.parse\(process\.argv\[1\]\), runPackagedCandidateNotificationProbe/);
  assert.doesNotMatch(createPackagedCandidateSchemaProbeSource(), /import\(['"]\.\.?\//);
});

test('probe snapshots hash sensitive values, preserve exact database timestamps, and omit unexpected columns', async () => {
  const database = databaseFixture();
  const result = await runPackagedCandidateNotificationProbe({ client: database.client, fixture, seed: false });
  const state = result.notificationContinuity;
  assert.equal(state.subscription.endpoint_hash, hash(database.subscription.endpoint));
  assert.equal(state.subscription.p256dh_hash, hash(database.subscription.p256dh));
  assert.equal(state.subscription.auth_hash, hash(database.subscription.auth));
  assert.equal(state.subscription.created_at, timestamp);
  assert.equal(state.notifications[0].payload_hash, hash(database.notifications[0].payload_text));
  assert.equal(state.notifications[0].next_attempt_at, future);
  assert.equal(state.notifications[1].terminal_at, timestamp);
  assert.doesNotMatch(JSON.stringify(result), /private-capability|synthetic-public-key|synthetic-auth-secret|private-test-content|extra_private_data|must-not-return/);
  assert.equal(database.calls.some(({ sql }) => sql.includes('INSERT')), false);
});

test('older schema snapshots explicitly omit additive fields without inventing new schema evidence', async () => {
  const database = databaseFixture({ current: false });
  const result = await runPackagedCandidateNotificationProbe({ client: database.client, fixture, seed: true });
  assert.deepEqual(result.notificationContinuity.columns, { registrationToken: false, claimToken: false, expiresAt: false, terminalAt: false });
  assert.deepEqual(result.notificationSchema.columns, []);
  assert.equal(Object.hasOwn(result.notificationContinuity.subscription, 'registration_token'), false);
  for (const row of result.notificationContinuity.notifications) {
    for (const field of ['claim_token', 'expires_at', 'terminal_at']) assert.equal(Object.hasOwn(row, field), false);
    assert.equal(row.expected_expires_at, future);
  }
  const writes = database.calls.filter(({ sql }) => sql.includes('INSERT'));
  assert.equal(writes.length, 5);
  assert.equal(writes.some(({ sql }) => /claim_token|expires_at|terminal_at|registration_token/.test(sql)), false);
});

test('current schema seeds four inert states with fixed-second lifetimes and synthetic registration material', async () => {
  const database = databaseFixture();
  await runPackagedCandidateNotificationProbe({ client: database.client, fixture, seed: true });
  const subscription = database.calls.find(({ sql }) => sql.includes('INSERT INTO user_push_subscriptions'));
  assert.equal(subscription.values[2], `https://push-fixture.invalid/continuity/${fixture.subscriptionId}`);
  assert.equal(Buffer.from(subscription.values[3], 'base64url').length, 65);
  assert.equal(Buffer.from(subscription.values[4], 'base64url').length, 16);
  const writes = database.calls.filter(({ sql }) => sql.includes('INSERT INTO notification_queue'));
  assert.deepEqual(writes.map(({ values }) => values[5]), statuses);
  for (const { sql, values } of writes) {
    assert.match(sql, /recorded_at \+ INTERVAL '31536000 seconds'/);
    assert.doesNotMatch(sql, /INTERVAL '365 days'/);
    assert.equal(values[1], fixture.userId); assert.equal(values[2], fixture.subscriptionId);
    assert.match(sql, /31536000, \$6, 0/);
  }
});

test('invalid or duplicated fixture identities fail before any database access', async () => {
  for (const invalid of [null, {}, { ...fixture, userId: 'bad-id' },
    { ...fixture, notificationIds: { ...fixture.notificationIds, pending: fixture.subscriptionId } }]) {
    const database = databaseFixture();
    await assert.rejects(runPackagedCandidateNotificationProbe({ client: database.client, fixture: invalid, seed: true }),
      { message: 'Packaged notification continuity probe failed' });
    assert.equal(database.calls.length, 0);
  }
});

test('fixture setup refuses an active owner before registering or queuing any notification', async () => {
  const database = databaseFixture({ disabled: false });
  await assert.rejects(runPackagedCandidateNotificationProbe({ client: database.client, fixture, seed: true }),
    { message: 'Packaged notification continuity probe failed' });
  assert.equal(database.calls.some(({ sql }) => sql.includes('INSERT')), false);
});

test('missing core schema, lost rows, and database errors fail without leaking query diagnostics', async () => {
  const incompleteSchema = databaseFixture(); incompleteSchema.definitions.shift();
  const missingRow = databaseFixture(); missingRow.notifications.pop();
  const failure = { client: { query: async () => { throw new Error('private SQL endpoint auth secret'); } } };
  for (const database of [incompleteSchema, missingRow, failure]) {
    await assert.rejects(runPackagedCandidateNotificationProbe({ client: database.client, fixture, seed: false }), (error) => {
      assert.equal(error.message, 'Packaged notification continuity probe failed');
      assert.equal(error.cause, undefined);
      assert.deepEqual(Object.keys(error), []);
      return true;
    });
  }
});
