/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { randomBytes, randomUUID } from 'node:crypto';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { createIntegrationFixturePhaseObserver } from './fixture-phase-observer.js';
import { resolveIntegrationTestRuntimeConfig } from './runtime-config.js';
import { createPostgresFailureEvidence } from './postgres-failure-evidence.js';
import { buildPostgresAdminConnectionConfig } from '../postgres-temporary-database.js';

const createDefaultContainer = image => new PostgreSqlContainer(image);

export async function createOwnedPostgresServer({ env = process.env, config = resolveIntegrationTestRuntimeConfig(env), signal,
  phaseObserver = createIntegrationFixturePhaseObserver({ env }),
  containerFactory = createDefaultContainer, failureEvidenceFactory = createPostgresFailureEvidence } = {}) {
  if (signal?.aborted) throw signal.reason;
  if (config.useContainerReuse) throw new TypeError('The parent test server must be newly owned');
  const evidenceMode = env.HARMONIARR_INTEGRATION_SERVER_DIAGNOSTICS ?? 'failures';
  if (!['off', 'failures'].includes(evidenceMode)) throw new TypeError('Invalid PostgreSQL server diagnostic setting');
  const container = await phaseObserver.measure('container_start', () => containerFactory(config.postgresImage)
    .withStartupTimeout(config.startupTimeoutMs).withDatabase('harmoniarr_parent')
    .withUsername('harmoniarr_parent').withPassword(randomBytes(32).toString('hex')).start());
  let closePromise;
  const close = () => {
    closePromise ??= phaseObserver.measure('container_stop', () => container.stop({ timeout: config.containerStopTimeoutMs }));
    closePromise.catch(() => {});
    return closePromise;
  };
  try {
    const owner = {
      env: Object.freeze({ PGHOST: container.getHost(), PGPORT: String(container.getPort()), PGUSER: container.getUsername(),
        PGPASSWORD: container.getPassword(), PGDATABASE: `hx_unallocated_${randomUUID().replaceAll('-', '')}`, PGMAINTENANCE_DB: 'postgres' }),
      close,
    };
    const evidence = failureEvidenceFactory({ mode: evidenceMode, source: 'testcontainer_postgres',
      fresh: containerFactory === createDefaultContainer, containerId: container.getId?.(),
      connectionConfig: buildPostgresAdminConnectionConfig(owner.env) });
    owner.createFailureCapture = evidence.createCapture;
    if (signal?.aborted) throw signal.reason;
    return owner;
  } catch (error) { await close().catch(() => {}); throw error; }
}
