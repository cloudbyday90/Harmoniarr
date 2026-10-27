/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import pg from 'pg';
import { buildConnectionConfig } from './database.js';
import { createDatabaseClientRetirement } from './database-client-retirement-service.js';

export const schemaObservationConnectionTimeoutMs = 2_000;

/** A single-use connection, never admitted to or borrowed from the application pool. */
export function createSchemaObservationConnection({ config = buildConnectionConfig(), Client = pg.Client,
  connectionTimeoutMs = schemaObservationConnectionTimeoutMs } = {}) {
  const client = new Client({ ...config, pipeline: false, connectionTimeoutMillis: connectionTimeoutMs });
  return { client, connect: () => client.connect(), ...createDatabaseClientRetirement(client) };
}
