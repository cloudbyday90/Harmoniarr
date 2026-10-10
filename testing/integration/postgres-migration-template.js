/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { attachPoolErrorHandler, buildConnectionConfig, buildPoolConfig } from '../../src/server/database.js';
import { buildPostgresAdminConnectionConfig, withTemporaryPostgresDatabase } from '../postgres-temporary-database.js';
import { createIntegrationFixturePhaseObserver } from './fixture-phase-observer.js';
import { loadMigrationTemplateInputs, buildMigrationTemplateFingerprint } from './migration-template-inputs.js';
import { prepareMigrationTemplateDatabase } from './migration-template-preparation.js';
import { createPostgresTemplateStore, templateDatabaseProfile, templateRefusal } from './postgres-template-store.js';

function assertNotAborted(signal) {
  if (signal != null && typeof signal.aborted !== 'boolean') throw new TypeError('Invalid template fixture signal');
  if (signal?.aborted) throw signal.reason;
}

/** A private migration-only baseline, never a scenario pool or a persisted cross-run cache. */
export async function createPreparedPostgresTemplate({
  env = process.env,
  createPool = (config) => new pg.Pool({ ...buildPoolConfig(env), ...config }),
  adminClientFactory = (config) => new pg.Client(config),
  databaseName = `harmoniarr_template_${randomUUID().replaceAll('-', '')}`,
  loadInputsFn = loadMigrationTemplateInputs,
  prepareDatabaseFn = prepareMigrationTemplateDatabase,
  withTemporaryPostgresDatabaseFn = withTemporaryPostgresDatabase,
  phaseObserver = createIntegrationFixturePhaseObserver({ env }),
  signal,
} = {}) {
  assertNotAborted(signal);
  env = Object.freeze({ ...env });
  if ([createPool, adminClientFactory, loadInputsFn, prepareDatabaseFn, withTemporaryPostgresDatabaseFn]
    .some((fn) => typeof fn !== 'function')) throw new TypeError('Invalid template fixture dependencies');
  const adminClient = adminClientFactory(buildPostgresAdminConnectionConfig(env));
  const store = createPostgresTemplateStore({ adminClient });
  const poolState = { closing: false }; let pool; let created = false; let oid;
  let fingerprint; let inputs; let profile;
  const closePool = async () => {
    if (!pool) return;
    poolState.closing = true;
    const closingPool = pool; pool = null;
    await phaseObserver.measure('pool_close', () => closingPool.end());
  };

  try {
    inputs = await loadInputsFn();
    assertNotAborted(signal);
    await phaseObserver.measure('database_connect', () => adminClient.connect());
    assertNotAborted(signal);
    await phaseObserver.measure('database_create', () => store.create(databaseName));
    created = true;
    const initial = await store.inspect(databaseName);
    if (!initial) throw templateRefusal();
    oid = initial.oid; profile = templateDatabaseProfile(initial);
    fingerprint = buildMigrationTemplateFingerprint({ inputs, databaseProfile: profile });
    assertNotAborted(signal);
    pool = await phaseObserver.measure('pool_create', () => createPool({ ...buildConnectionConfig(env), database: databaseName }));
    attachPoolErrorHandler(pool, { runtimeState: poolState });
    assertNotAborted(signal);
    await phaseObserver.measure('template_prepare', () => prepareDatabaseFn({ getPoolFn: () => pool, inputs }));
    assertNotAborted(signal);
    const after = await loadInputsFn();
    if (buildMigrationTemplateFingerprint({ inputs: after, databaseProfile: profile }) !== fingerprint) {
      throw templateRefusal('fixture_template_fingerprint_changed');
    }
    await closePool();
    assertNotAborted(signal);
    const sealed = await phaseObserver.measure('template_seal', () => store.seal(databaseName, oid));
    if (buildMigrationTemplateFingerprint({ inputs: after, databaseProfile: templateDatabaseProfile(sealed) }) !== fingerprint) {
      throw templateRefusal('fixture_template_fingerprint_changed');
    }
    assertNotAborted(signal);
  } catch (primaryError) {
    await closePool().catch(() => {});
    if (created) await phaseObserver.measure('template_drop', async () => {
      if (!oid) throw templateRefusal('fixture_template_cleanup_incomplete');
      await store.dropOwned(databaseName, oid);
    }).catch(() => {});
    await phaseObserver.measure('admin_close', () => adminClient.end()).catch(() => {});
    throw primaryError;
  }

  const active = new Set(); let closed = false; let cleanupPromise;
  const owner = {
    schemaMode: 'migration_template',
    async runIsolatedDatabase(run, { phaseObserver: observer = phaseObserver.child(), signal: caseSignal } = {}) {
      if (closed) throw templateRefusal('fixture_template_closed');
      if (typeof run !== 'function') throw new TypeError('Template scenario requires a callback');
      assertNotAborted(caseSignal);
      const operation = Promise.resolve().then(() => withTemporaryPostgresDatabaseFn({
        env, createPool, adminClientFactory, strictCleanup: true, signal: caseSignal, phaseObserver: observer,
        createDatabaseFn: async ({ adminClient: cloneAdmin, databaseName: cloneName }) => {
          const cloneStore = createPostgresTemplateStore({ adminClient: cloneAdmin });
          await observer.measure('template_verify', async () => {
            const currentInputs = await loadInputsFn();
            const source = await cloneStore.assertSealed(databaseName, oid);
            if (buildMigrationTemplateFingerprint({ inputs: currentInputs, databaseProfile: templateDatabaseProfile(source) }) !== fingerprint) {
              throw templateRefusal('fixture_template_fingerprint_changed');
            }
            assertNotAborted(caseSignal);
          });
          assertNotAborted(caseSignal);
          await cloneStore.createClone(cloneName, databaseName);
        },
        run: (context) => run({ ...context, schemaMode: 'migration_template' }),
      }));
      active.add(operation);
      try { return await operation; }
      finally { active.delete(operation); }
    },
    cleanup() {
      closed = true;
      if (!cleanupPromise) {
        cleanupPromise = (async () => {
          await Promise.allSettled([...active]);
          let failed = false; let failure;
          try { await phaseObserver.measure('template_drop', () => store.dropOwned(databaseName, oid)); }
          catch (error) { failed = true; failure = error; }
          try { await phaseObserver.measure('admin_close', () => adminClient.end()); }
          catch (error) { if (!failed) { failed = true; failure = error; } }
          if (failed) throw failure;
        })();
        cleanupPromise.catch(() => {});
      }
      return cleanupPromise;
    },
  };
  return owner;
}
