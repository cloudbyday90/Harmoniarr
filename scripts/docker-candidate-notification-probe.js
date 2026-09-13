/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

// Serialized alongside the packaged schema probe. Keep dependencies local and
// use only its already connected transaction client, never a host database.
export async function runPackagedCandidateNotificationProbe({ client, fixture, seed }) {
  try {
    const { createECDH, createHash, randomBytes } = await import('node:crypto');
    const statuses = ['pending', 'sent', 'failed', 'expired'];
    const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
    const ids = [fixture?.userId, fixture?.subscriptionId, ...statuses.map((status) => fixture?.notificationIds?.[status])];
    if (typeof client?.query !== 'function' || typeof seed !== 'boolean'
      || ids.some((id) => typeof id !== 'string' || !uuid.test(id)) || new Set(ids).size !== ids.length) throw new Error();
    const definitions = (await client.query(`SELECT relation.relname AS "tableName", attribute.attname AS name,
      format_type(attribute.atttypid, attribute.atttypmod) AS "dataType", NOT attribute.attnotnull AS "isNullable",
      pg_get_expr(default_value.adbin, default_value.adrelid) AS "defaultExpression"
      FROM pg_attribute attribute JOIN pg_class relation ON relation.oid = attribute.attrelid
      JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
      LEFT JOIN pg_attrdef default_value ON default_value.adrelid = attribute.attrelid AND default_value.adnum = attribute.attnum
      WHERE namespace.nspname = 'public' AND relation.relname IN ('notification_queue', 'user_push_subscriptions')
        AND attribute.attnum > 0 AND NOT attribute.attisdropped ORDER BY relation.relname, attribute.attnum`)).rows;
    if (!Array.isArray(definitions) || definitions.length > 100) throw new Error();
    const hasColumn = (table, column) => definitions.some((row) => row.tableName === table && row.name === column);
    const required = {
      notification_queue: ['id', 'user_id', 'subscription_id', 'event_type', 'coalesce_key', 'payload', 'ttl_seconds',
        'status', 'attempts', 'next_attempt_at', 'sent_at', 'created_at'],
      user_push_subscriptions: ['id', 'user_id', 'endpoint', 'p256dh', 'auth', 'user_agent', 'invalidated_at', 'created_at'],
    };
    for (const [table, names] of Object.entries(required)) if (!names.every((name) => hasColumn(table, name))) throw new Error();
    const columns = {
      registrationToken: hasColumn('user_push_subscriptions', 'registration_token'),
      claimToken: hasColumn('notification_queue', 'claim_token'),
      expiresAt: hasColumn('notification_queue', 'expires_at'),
      terminalAt: hasColumn('notification_queue', 'terminal_at'),
    };
    const constraints = (await client.query(`SELECT relation.relname AS "tableName", constraint_record.conname AS name,
      constraint_record.contype AS type, constraint_record.convalidated AS validated,
      constraint_record.condeferrable AS deferrable, pg_get_constraintdef(constraint_record.oid) AS definition
      FROM pg_constraint constraint_record JOIN pg_class relation ON relation.oid = constraint_record.conrelid
      JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
      WHERE namespace.nspname = 'public' AND relation.relname = 'notification_queue'
        AND constraint_record.conname IN ('notification_queue_claim_pending_check',
          'notification_queue_terminal_state_check', 'notification_queue_subscription_id_fkey')
      ORDER BY constraint_record.conname`)).rows;
    if (!Array.isArray(constraints) || constraints.length > 3) throw new Error();
    if (seed) {
      const owner = (await client.query('SELECT is_disabled FROM app_users WHERE id = $1', [fixture.userId])).rows;
      if (owner.length !== 1 || owner[0].is_disabled !== true) throw new Error();
      const key = createECDH('prime256v1').generateKeys().toString('base64url');
      await client.query(`INSERT INTO user_push_subscriptions
        (id, user_id, endpoint, p256dh, auth, user_agent, invalidated_at)
        VALUES ($1, $2, $3, $4, $5, 'Packaged continuity fixture', clock_timestamp())`,
      [fixture.subscriptionId, fixture.userId, `https://push-fixture.invalid/continuity/${fixture.subscriptionId}`,
        key, randomBytes(16).toString('base64url')]);
      for (const status of statuses) {
        // All schedules remain ineligible throughout acceptance, including on
        // older workers. The invalidated registration is additional containment.
        await client.query(`WITH captured AS MATERIALIZED (SELECT clock_timestamp() AS recorded_at)
          INSERT INTO notification_queue (id, user_id, subscription_id, event_type, coalesce_key, payload,
            ttl_seconds, status, attempts, next_attempt_at, sent_at, created_at
            ${columns.claimToken ? ', claim_token' : ''}${columns.expiresAt ? ', expires_at' : ''}${columns.terminalAt ? ', terminal_at' : ''})
          SELECT $1, $2, $3, 'releaseAdded', $4, $5::jsonb, 31536000, $6, 0,
            recorded_at + INTERVAL '31536000 seconds', CASE WHEN $6 = 'sent' THEN recorded_at ELSE NULL END, recorded_at
            ${columns.claimToken ? ', NULL' : ''}${columns.expiresAt ? ", recorded_at + INTERVAL '31536000 seconds'" : ''}
            ${columns.terminalAt ? ", CASE WHEN $6 = 'pending' THEN NULL ELSE recorded_at END" : ''} FROM captured`,
        [fixture.notificationIds[status], fixture.userId, fixture.subscriptionId, `candidate-continuity-${status}`,
          JSON.stringify({ title: 'Packaged continuity fixture', fixture: 'docker-candidate-continuity', status }), status]);
      }
    }
    const subscription = (await client.query(`SELECT id, user_id, endpoint, p256dh, auth, user_agent,
      invalidated_at::text, created_at::text ${columns.registrationToken ? ', registration_token' : ''}
      FROM user_push_subscriptions WHERE id = $1`, [fixture.subscriptionId])).rows[0];
    const notifications = (await client.query(`SELECT id, user_id, subscription_id, event_type, coalesce_key,
      payload::text AS payload_text, ttl_seconds, status, attempts, next_attempt_at::text, sent_at::text, created_at::text,
      (created_at + (ttl_seconds * INTERVAL '1 second'))::text AS expected_expires_at
      ${columns.claimToken ? ', claim_token' : ''}${columns.expiresAt ? ', expires_at::text' : ''}${columns.terminalAt ? ', terminal_at::text' : ''}
      FROM notification_queue WHERE id = ANY($1::uuid[]) ORDER BY array_position($1::uuid[], id)`,
    [statuses.map((status) => fixture.notificationIds[status])])).rows;
    if (!subscription || !Array.isArray(notifications) || notifications.length !== statuses.length) throw new Error();
    const hash = (value) => {
      if (typeof value !== 'string') throw new Error();
      return createHash('sha256').update(value).digest('hex');
    };
    const pick = (row, fields) => Object.fromEntries(fields.map((field) => {
      if (!Object.hasOwn(row, field)) throw new Error();
      return [field, row[field]];
    }));
    const observedAt = (await client.query('SELECT clock_timestamp()::text AS "observedAt"')).rows[0]?.observedAt;
    if (typeof observedAt !== 'string' || !Number.isFinite(Date.parse(observedAt))) throw new Error();
    return {
      notificationSchema: {
        columns: definitions.filter((row) => (row.tableName === 'user_push_subscriptions' && row.name === 'registration_token')
          || (row.tableName === 'notification_queue' && ['claim_token', 'expires_at', 'terminal_at'].includes(row.name)))
          .map((row) => pick(row, ['tableName', 'name', 'dataType', 'isNullable', 'defaultExpression'])),
        constraints: constraints.map((row) => pick(row, ['tableName', 'name', 'type', 'validated', 'deferrable', 'definition'])),
      },
      notificationContinuity: {
        columns, observedAt,
        subscription: { ...pick(subscription, ['id', 'user_id', 'user_agent', 'invalidated_at', 'created_at',
          ...(columns.registrationToken ? ['registration_token'] : [])]),
        endpoint_hash: hash(subscription.endpoint), p256dh_hash: hash(subscription.p256dh), auth_hash: hash(subscription.auth) },
        notifications: notifications.map((row) => ({ ...pick(row, ['id', 'user_id', 'subscription_id', 'event_type', 'coalesce_key',
          'ttl_seconds', 'status', 'attempts', 'next_attempt_at', 'sent_at', 'created_at', 'expected_expires_at',
          ...(columns.claimToken ? ['claim_token'] : []), ...(columns.expiresAt ? ['expires_at'] : []), ...(columns.terminalAt ? ['terminal_at'] : [])]),
        payload_hash: hash(row.payload_text) })),
      },
    };
  } catch {
    throw new Error('Packaged notification continuity probe failed');
  }
}
