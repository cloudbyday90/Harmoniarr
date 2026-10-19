/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { performance } from 'node:perf_hooks';
import pg from 'pg';
import PgConnection from 'pg/lib/connection.js';
import { observeOwnedPgConnections } from './owned-pg-connection-observer.js';
import { buildIntegrationPoolConfig } from './pool-policy.js';
import { withFixtureLifecycle } from './fixture-lifecycle.js';
import { withWorkerTaskCleanup } from '../../src/server/worker-task-cleanup.js';

/** One cold native checkout; no verifier/hostname substitution or shared connection reuse. */
export async function observePostgresTlsAttempt({ databaseConfig, config, host, ca, callback = false, signal }) {
  return withFixtureLifecycle({ signal }, async scope => {
    const ssl = { ca, rejectUnauthorized: true, minVersion: 'TLSv1.2' };
    const target = { ...databaseConfig, host, ssl };
    const connection = new PgConnection({ ssl });
    const pool = new pg.Pool({ ...target, ...buildIntegrationPoolConfig(config), connection });
    const observer = observeOwnedPgConnections({ pool, expectedConfig: target, now: () => performance.now() });
    const owned = observer.begin(); const sockets = new Map();
    const proof = { failed: false, error: undefined, atStream: null, atHandshake: null, authorized: false,
      secureConnects: 0, sslRow: null, record: null, poolEnded: false, socketsClosed: false, restored: false };
    let client;
    function track(socket) {
      if (sockets.has(socket)) return;
      sockets.set(socket, new Promise(resolve => { socket.once('close', resolve); }));
      if (scope.signal.aborted) socket.destroy();
    }
    track(connection.stream);
    scope.onRelease(() => { for (const socket of sockets.keys()) socket.destroy(); });
    const onTls = () => {
      const stream = connection.stream; track(stream); proof.atStream = owned.snapshot();
      stream.once('secureConnect', onSecure);
    };
    const onSecure = () => {
      proof.secureConnects++; proof.authorized = connection.stream.authorized === true; proof.atHandshake = owned.snapshot();
    };
    await withWorkerTaskCleanup(async () => {
      try {
        const pending = owned.dispatch(() => callback ? new Promise((resolve, reject) => {
          pool.connect((error, acquired) => { if (error) reject(error); else resolve(acquired); });
        }) : pool.connect());
        connection.once('sslconnect', onTls);
        client = await pending;
        proof.sslRow = (await client.query('SELECT ssl, version FROM pg_stat_ssl WHERE pid = pg_backend_pid()')).rows[0];
      } catch (error) { proof.failed = true; proof.error = error; }
    }, async () => {
      await withWorkerTaskCleanup(async () => {
        client?.release(true); await pool.end(); proof.poolEnded = pool.ended;
      }, async () => {
        for (const socket of sockets.keys()) socket.destroy();
        await Promise.all(sockets.values()); proof.socketsClosed = [...sockets.keys()].every(socket => socket.closed);
        proof.record = owned.snapshot(); owned.finish();
        try { observer.restore(); }
        finally { connection.removeListener('sslconnect', onTls); connection.stream.removeListener('secureConnect', onSecure); }
        proof.restored = !Object.hasOwn(connection, 'startup') && pool.Client === pg.Client;
      });
    });
    return proof;
  });
}
