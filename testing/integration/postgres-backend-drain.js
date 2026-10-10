/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { performance } from 'node:perf_hooks';
import { setTimeout as pauseFor } from 'node:timers/promises';

const incomplete = () => Object.assign(new Error('Owned fixture database backends could not be verified drained'),
  { code: 'fixture_database_drain_incomplete' });

export async function drainPostgresFixtureBackends({ adminClient, databaseName, timeoutMs = 5000,
  now = () => performance.now(), pause = () => pauseFor(50) } = {}) {
  if (typeof adminClient?.query !== 'function' || typeof databaseName !== 'string' || !databaseName
    || !Number.isFinite(timeoutMs) || timeoutMs <= 0 || typeof now !== 'function' || typeof pause !== 'function') {
    throw new TypeError('Invalid fixture database drain options');
  }
  const started = now();
  if (!Number.isFinite(started)) throw incomplete();
  while (true) {
    const result = await adminClient.query(`SELECT COUNT(*)::integer AS active_count
      FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()`, [databaseName]);
    const count = result.rows[0]?.active_count;
    if (!Number.isSafeInteger(count) || count < 0) throw incomplete();
    if (count === 0) return;
    const observed = now();
    if (!Number.isFinite(observed) || observed < started || observed - started >= timeoutMs) throw incomplete();
    await adminClient.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity
      WHERE datname=$1 AND pid<>pg_backend_pid()`, [databaseName]);
    await pause();
  }
}
