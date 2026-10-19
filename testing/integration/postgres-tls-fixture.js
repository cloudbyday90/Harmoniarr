/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { createPostgresIntegrationRuntime } from '../postgres-integration-runtime.js';
import { withWorkerTaskCleanup } from '../../src/server/worker-task-cleanup.js';
import certificates from './fixtures/postgres-tls.json' with { type: 'json' };

const createTlsContainer = ({ config, cert, key }) => new PostgreSqlContainer(config.postgresImage)
  .withStartupTimeout(config.startupTimeoutMs).withDatabase('harmoniarr').withUsername('harmoniarr').withPassword('harmoniarr')
  .withSSL(cert, key);

/** Public test keys only. Server retirement precedes temporary file removal. */
export async function withPostgresTlsFixture({ config, profile = 'matched', signal,
  createRuntime = createPostgresIntegrationRuntime, createContainer = createTlsContainer }, run) {
  if (!['matched', 'mismatched'].includes(profile) || typeof run !== 'function') throw new TypeError('Invalid PostgreSQL TLS fixture');
  signal?.throwIfAborted();
  const root = await mkdtemp(join(tmpdir(), 'harmoniarr-pg-tls-'));
  let retired = true;
  return withWorkerTaskCleanup(async () => {
    const cert = join(root, 'server.crt'); const key = join(root, 'server.key');
    await writeFile(cert, certificates[profile].cert, { mode: 0o600 });
    await writeFile(key, certificates[profile].key, { mode: 0o600 });
    retired = false;
    const runtime = await createRuntime({ config, env: {}, signal,
      createPostgresContainer: () => createContainer({ config, cert, key }) });
    return withWorkerTaskCleanup(() => runtime.runIsolatedDatabase(input => run({ ...input, ca: certificates.ca }), { signal }),
      async () => { await runtime.cleanup(); retired = true; });
  }, async () => { if (retired) await rm(root, { recursive: true, force: true }); });
}
