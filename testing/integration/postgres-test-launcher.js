/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import pg from 'pg';
import { performance } from 'node:perf_hooks';
import { buildPostgresAdminConnectionConfig } from '../postgres-temporary-database.js';
import { createOwnedPostgresServer } from './owned-postgres-server.js';
import { createParentPostgresStore } from './parent-postgres-store.js';
import { createParentPostgresRegistry } from './parent-postgres-registry.js';
import { createParentPostgresControlServer } from './parent-postgres-control-server.js';
import { parentPostgresClientError, parentPostgresEnvironmentKeys } from './parent-postgres-client.js';
import { runPostgresTestFile } from './postgres-file-process.js';
import { resolvePostgresTestCohort } from './postgres-test-cohort.js';

export function postgresWorkersAreQuiescent(pids, probe = process.kill.bind(process)) {
  return pids.every((pid) => {
    try { probe(pid, 0); return false; }
    catch (error) { return error?.code === 'ESRCH'; }
  });
}

export async function runSharedPostgresTests({ args = [], cwd = process.cwd(), env = process.env,
  signal, stdout = process.stdout, stderr = process.stderr,
  resolveFiles = resolvePostgresTestCohort, createServer = createOwnedPostgresServer,
  createAdminClient = (config) => new pg.Client(config), createStore = createParentPostgresStore,
  createRegistry = createParentPostgresRegistry, createControlServer = createParentPostgresControlServer,
  runFile = runPostgresTestFile, workersAreQuiescent = postgresWorkersAreQuiescent } = {}) {
  if (signal?.aborted) throw signal.reason;
  const files = await resolveFiles({ args, cwd });
  if (signal?.aborted) throw signal.reason;
  const started = performance.now();
  const totals = { files: files.length, completed: 0, registered: 0, released: 0, reaped: 0 };
  let owner; let admin; let control; let registry; let scope; let quiescent = true;
  let failed = false; let primaryError;
  const remember = (error) => { if (!failed) { failed = true; primaryError = error; } };
  async function cleanup(operation) { try { await operation(); } catch (error) { remember(error); } }
  async function finishScope() {
    if (!scope) return;
    const current = scope; scope = undefined;
    registry.closeAdmission(current.token);
    const stopped = quiescent && workersAreQuiescent(registry.workerPids(current.token));
    const stats = await registry.finishScope(current.token, { workersQuiescent: stopped });
    for (const key of ['registered', 'released', 'reaped']) totals[key] += stats[key];
  }
  try {
    owner = await createServer({ signal });
    admin = createAdminClient({ ...buildPostgresAdminConnectionConfig(owner.env), statement_timeout: 5000 });
    await admin.connect();
    registry = createRegistry({ store: createStore({ adminClient: admin }) });
    control = await createControlServer({ registry });
    for (const file of files) {
      if (signal?.aborted) throw signal.reason;
      scope = registry.beginScope(); quiescent = false;
      const token = scope.token;
      const childEnv = { ...env, ...owner.env,
        [parentPostgresEnvironmentKeys.mode]: 'parent',
        [parentPostgresEnvironmentKeys.endpoint]: control.endpoint,
        [parentPostgresEnvironmentKeys.token]: token };
      let result;
      try {
        result = await runFile({ file, cwd, env: childEnv, signal, stdout, stderr,
          onCancel: () => registry.closeAdmission(token),
          onTermination: (status) => { quiescent = status.quiescent === true; } });
        quiescent = true;
        if (result.exitCode !== 0) throw parentPostgresClientError('fixture_parent_test_failed');
      } catch (error) { remember(error); }
      await cleanup(finishScope);
      if (failed) break;
      totals.completed += 1;
    }
  } catch (error) { remember(error); }
  finally {
    await cleanup(finishScope);
    if (control) await cleanup(() => control.close());
    if (admin) await cleanup(() => admin.end());
    if (owner) await cleanup(() => owner.close());
  }
  if (failed) throw primaryError;
  return { ...totals, durationMs: Math.max(0, performance.now() - started) };
}
