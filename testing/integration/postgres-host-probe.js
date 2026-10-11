/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import pg from 'pg';

export const postgresProbeSql = "SELECT current_setting('server_version_num')::integer AS version, pg_is_in_recovery() AS recovery";
/** One independent native client; never borrows from the failing pool. */
export function createPostgresHostProbe({ connectionConfig, clientFactory = config => new pg.Client(config) }) {
  const config = Object.freeze({ ...connectionConfig, connectionTimeoutMillis: 1000,
    query_timeout: 1000, statement_timeout: 1000 });
  return async () => {
    let client;
    let result = { outcome: 'failed', stage: 'connect', closed: false };
    let asynchronousError;
    let errorObserved = false;
    const onError = error => { if (!errorObserved) { errorObserved = true; asynchronousError = error; } };
    try {
      client = clientFactory(config);
      client.on('error', onError);
      await client.connect();
      result.stage = 'query';
      const response = await client.query(postgresProbeSql);
      result = { outcome: 'passed', stage: 'query', version: response.rows[0]?.version,
        recovery: response.rows[0]?.recovery, closed: false };
    } catch (error) { result.error = error; }
    if (client) {
      try { await client.end(); result.closed = true; }
      catch (error) {
        if (result.outcome === 'passed') result = { outcome: 'failed', stage: 'close', error, closed: false };
      }
      client.removeListener('error', onError);
    }
    if (errorObserved && result.outcome === 'passed') {
      result = { ...result, outcome: 'failed', error: asynchronousError };
    }
    return result;
  };
}
