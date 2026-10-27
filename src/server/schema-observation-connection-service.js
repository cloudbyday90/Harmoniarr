/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import pg from 'pg';
import { buildConnectionConfig } from './database.js';

export const schemaObservationConnectionTimeoutMs = 2_000;

/** A single-use connection, never admitted to or borrowed from the application pool. */
export function createSchemaObservationConnection({ config = buildConnectionConfig(), Client = pg.Client,
  connectionTimeoutMs = schemaObservationConnectionTimeoutMs } = {}) {
  const client = new Client({ ...config, pipeline: false, connectionTimeoutMillis: connectionTimeoutMs });
  let closing;
  return { client, connect: () => client.connect(), close({ force = false } = {}) {
    // pg 8.23.1: end() alone can wait for a graceful idle/startup flush. Abort must
    // also destroy this owned transport. Keep the version-sensitive surface here.
    if (force) client.connection.stream.destroy();
    closing ??= client.end();
    return closing;
  } };
}
