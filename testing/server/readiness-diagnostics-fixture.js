/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import pg from 'pg';
import { buildConnectionConfig } from '/app/server-dist/database.js';
import { createSystemService } from '/app/server-dist/system-service.js';
import { createSystemModule } from '/app/server-dist/system-module.js';
import { createHealthReadinessService } from '/app/server-dist/readiness/health-readiness-service.js';
import { createReadinessDiagnosticsService } from '/app/server-dist/readiness/readiness-diagnostics-service.js';
import { createReadinessDiagnosticLogService } from '/app/server-dist/readiness/readiness-diagnostic-log-service.js';

export const readinessFixtureLockNamespace = 724217;
export function createReadinessDiagnosticsFixture({ pool, anchor }) {
  let mode = 'healthy', module, waiter;
  const lines = [], failures = [], completed = [];
  let clock = 0, sinkThrows = false;
  const stream = { write: (line, callback) => { if (sinkThrows) throw new Error('Fixture log sink failure'); lines.push(line); return process.stderr.write(line, callback); },
    on: (...args) => process.stderr.on(...args), once: (...args) => process.stderr.once(...args), removeListener: (...args) => process.stderr.removeListener(...args) };
  const diagnostics = createReadinessDiagnosticsService({ logService: createReadinessDiagnosticLogService({ stream, nowFn: () => clock }) });
  async function capture(work) { try { return await work(); } catch (error) { failures.push(error); throw error; } }
  async function missingRelation() { return capture(() => pool.query('SELECT * FROM fixture_readiness_private_secret')); }
  async function cancelledQuery() {
    const client = await pool.connect();
    try { await client.query("SET statement_timeout='25ms'"); return await capture(() => client.query('SELECT pg_sleep(1)')); }
    finally { try { await client.query('RESET statement_timeout'); } finally { client.release(); } }
  }
  async function refusedConnection() {
    const listener = createServer(); await new Promise(resolve => { listener.listen(0, '127.0.0.1', resolve); });
    const port = listener.address().port; await new Promise(resolve => { listener.close(resolve); });
    const client = new pg.Client({ ...buildConnectionConfig(), host: '127.0.0.1', port, connectionTimeoutMillis: 1000 });
    try { return await capture(() => client.connect()); } finally { await client.end(); }
  }
  async function getOverview(options, systemOptions) {
    if (mode === 'healthy') return module.systemService.getOverview(options);
    const overrides = {};
    if (mode === 'missing_file') overrides.readPackageMetadataFn = () => capture(async () => JSON.parse(await readFile(anchor + '/private-secret-missing.json', 'utf8')));
    if (mode === 'query_error') overrides.operationHistoryService = { ...systemOptions.operationHistoryService, countActiveOperationRuns: missingRelation };
    if (mode === 'query_cancelled' || mode === 'connection_refused' || mode === 'database_wait') {
      overrides.getPoolFn = () => ({ query: async (...args) => {
        if (mode === 'query_cancelled') return cancelledQuery();
        if (mode === 'connection_refused') return refusedConnection();
        await waiter.query('SELECT pg_advisory_lock($1::int,1)', [readinessFixtureLockNamespace]);
        await waiter.query('SELECT pg_advisory_unlock($1::int,1)', [readinessFixtureLockNamespace]);
        return pool.query(...args);
      } });
    }
    return createSystemService({ ...systemOptions, activityFeedService: module.activityFeedService, ...overrides }).getOverview(options);
  }
  return {
    lines, failures, completed, diagnostics,
    setMode(value) { mode = value; clock += 15_000; },
    setSinkThrows(value) { sinkThrows = value; },
    setWaiter(value) { waiter = value; },
    buildSystemModule(systemOptions) {
      const health = createHealthReadinessService({ getOverview: options => getOverview(options, systemOptions), appPort: systemOptions.appPort, diagnostics });
      module = createSystemModule({ ...systemOptions, healthReadinessService: health });
      const check = module.routeDependencies.checkHealth;
      module.routeDependencies.checkHealth = async () => { const result = await check(); completed.push(result); return result; };
      return module;
    },
  };
}
