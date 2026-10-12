/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import pg from 'pg';
import { createFixtureLockObserver } from './fixture-lock-observer.js';

/** Observe the acknowledged scenario database without competing for its held pool. */
export async function withFixturePostgresObserver({ connectionConfig, signal,
  clientFactory = config => new pg.Client(config) } = {}, run) {
  if (!connectionConfig || typeof connectionConfig !== 'object' || typeof run !== 'function') {
    throw new TypeError('Independent fixture observation requires owned connection config and work');
  }
  if (signal?.aborted) throw signal.reason;
  const client = clientFactory({ ...connectionConfig, connectionTimeoutMillis: 1000,
    query_timeout: 1000, statement_timeout: 1000 });
  const observer = createFixtureLockObserver({ queryable: client, signal });
  client.on('error', () => {});
  let failed = false; let failure; let result;
  try {
    await client.connect();
    if (signal?.aborted) throw signal.reason;
    result = await run(observer);
  } catch (error) { failed = true; failure = error; }
  await observer.drain();
  try { await client.end(); }
  catch (error) { if (!failed) { failed = true; failure = error; } }
  if (failed) throw failure;
  return result;
}
