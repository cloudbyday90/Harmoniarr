/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { randomBytes, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import pg from 'pg';
import { createRecoveryDockerCommand } from './postgres-recovery-command.js';

// Official PostgreSQL 18.6 image, resolved from the registry on 2026-09-11.
export const postgresRecoveryImage = 'postgres:18.6-alpine@sha256:d3e1620b530c944afa6e887d22eb899824da68e19c52024bf98f5220c88a65b2';

const ownershipLabel = 'io.harmoniarr.postgres-recovery';
const databaseUser = 'recovery_fixture';
const databaseNames = Object.freeze({ source: 'recovery_source', restored: 'recovery_restored', collision: 'recovery_collision' });
const archivePath = '/tmp/harmoniarr-recovery.dump';

function check(condition) {
  if (!condition) throw new Error('The isolated PostgreSQL runtime did not satisfy its safety contract');
}

export async function assertLocalRecoveryDocker({ runDocker, env = process.env }) {
  const localEndpoint = (value) => /^(?:unix:\/\/\/|npipe:\/\/\/\/\.\/pipe\/)/.test(value);
  check(!env.DOCKER_HOST || localEndpoint(env.DOCKER_HOST));
  const endpoint = (await runDocker(['context', 'inspect', '--format', '{{.Endpoints.docker.Host}}'])).stdout.trim();
  check(localEndpoint(endpoint));
}

export async function closeRecoveryPools(pools, { timeoutMs = 5_000 } = {}) {
  let timer;
  try {
    const results = await Promise.race([
      Promise.allSettled(pools.map((pool) => Promise.resolve().then(() => pool.end()))),
      new Promise((resolve) => { timer = setTimeout(() => resolve(null), timeoutMs); }),
    ]);
    return results !== null && results.every((entry) => entry.status === 'fulfilled');
  } finally { clearTimeout(timer); }
}

export function verifyRecoveryContainer(description, { nonce, name, containerId }) {
  check(description.Id === containerId && description.Name === `/${name}`
    && description.Config?.Labels?.[ownershipLabel] === nonce);
  check(Array.isArray(description.Mounts) && description.Mounts.every((mount) => mount.Type !== 'bind'));
  const bindings = description.NetworkSettings?.Ports?.['5432/tcp'];
  check(Array.isArray(bindings) && bindings.length === 1 && bindings[0].HostIp === '127.0.0.1');
  const port = Number(bindings[0].HostPort);
  check(Number.isInteger(port) && port > 0 && port <= 65535);
  check(/^sha256:[a-f0-9]{64}$/.test(description.Image));
  return { port, imageId: description.Image };
}

export async function withPostgresRecoveryRuntime({
  run, env = process.env, runDocker = createRecoveryDockerCommand({ env }), createPoolFn = (config) => new pg.Pool(config),
} = {}) {
  if (typeof run !== 'function') throw new Error('A PostgreSQL rehearsal callback is required');
  const nonce = randomUUID();
  const name = `harmoniarr-pg-recovery-${nonce}`;
  const password = randomBytes(32).toString('base64url');
  const pools = [];
  let containerId = null;
  let result;
  let failure;
  let cleanupVerified = false;
  let creationAttempted = false;
  try {
    await assertLocalRecoveryDocker({ runDocker, env });
    await runDocker(['pull', postgresRecoveryImage], { timeoutMs: 120_000 });
    creationAttempted = true;
    const started = await runDocker(['run', '--detach', '--name', name,
      '--label', `${ownershipLabel}=${nonce}`, '--publish', '127.0.0.1::5432',
      '--env', 'POSTGRES_PASSWORD', '--env', `POSTGRES_USER=${databaseUser}`, '--env', `POSTGRES_DB=${databaseNames.source}`,
      '--security-opt', 'no-new-privileges:true', '--memory', '512m', '--cpus', '2', '--pids-limit', '128',
      '--tmpfs', '/tmp:rw,noexec,nosuid,size=128m', postgresRecoveryImage], {
      environment: { POSTGRES_PASSWORD: password }, timeoutMs: 120_000,
    });
    containerId = started.stdout.trim();
    check(/^[a-f0-9]{64}$/.test(containerId));
    const inspected = await runDocker(['container', 'inspect', containerId]);
    const [description] = JSON.parse(inspected.stdout);
    const { port, imageId } = verifyRecoveryContainer(description, { nonce, name, containerId });
    const connection = { host: '127.0.0.1', port, user: databaseUser, password, ssl: false,
      connectionTimeoutMillis: 2_000, query_timeout: 30_000, statement_timeout: 25_000,
      max: 2, idleTimeoutMillis: 1_000, allowExitOnIdle: true };
    const openPool = (database) => {
      const pool = createPoolFn({ ...connection, database });
      // Keep transient fixture connection errors out of operator output.
      pool.on('error', () => {});
      pool.on('connect', (client) => client.on('error', () => {}));
      pools.push(pool);
      return pool;
    };
    const sourcePool = openPool(databaseNames.source);
    const deadline = Date.now() + 60_000;
    while (true) {
      try { await sourcePool.query('SELECT 1'); break; } catch {
        if (Date.now() >= deadline) throw new Error('The isolated PostgreSQL database did not become ready');
        await delay(250);
      }
    }
    const version = (await sourcePool.query('SHOW server_version_num')).rows[0].server_version_num;
    check(/^18\d{4}$/.test(version) && Number(version) >= 180006);
    const execPostgres = (args, options) => runDocker(['exec', '--user', 'postgres', containerId, ...args], options);
    let dumped = false;
    async function createRestoreTarget(kind) {
      check(['restored', 'collision'].includes(kind));
      const database = databaseNames[kind];
      await sourcePool.query(`CREATE DATABASE "${database}" TEMPLATE template0`);
      return openPool(database);
    }
    async function restore(kind, expectedExitCodes = [0]) {
      check(dumped && ['restored', 'collision'].includes(kind));
      return execPostgres(['pg_restore', '--host=/var/run/postgresql', `--username=${databaseUser}`,
        `--dbname=${databaseNames[kind]}`, '--no-password', '--exit-on-error', '--single-transaction',
        '--no-owner', '--no-acl', '--no-tablespaces', archivePath], { expectedExitCodes });
    }
    async function dumpAndRestore() {
      check(!dumped);
      await execPostgres(['pg_dump', '--host=/var/run/postgresql', `--username=${databaseUser}`,
        `--dbname=${databaseNames.source}`, '--no-password', '--format=custom', '--lock-wait-timeout=5s', `--file=${archivePath}`]);
      dumped = true;
      const checksum = (await execPostgres(['sha256sum', archivePath])).stdout.split(/\s+/)[0];
      const archiveBytes = Number((await execPostgres(['stat', '-c', '%s', archivePath])).stdout.trim());
      check(/^[a-f0-9]{64}$/.test(checksum) && Number.isSafeInteger(archiveBytes) && archiveBytes > 0 && archiveBytes <= 134_217_728);
      const targetPool = await createRestoreTarget('restored');
      await restore('restored');
      const collisionPool = await createRestoreTarget('collision');
      await collisionPool.query('CREATE TABLE media_requests (sentinel integer PRIMARY KEY); INSERT INTO media_requests VALUES (42)');
      const rejected = await restore('collision', [0, 1]);
      check(rejected.exitCode === 1 && rejected.stderr.includes('media_requests') && rejected.stderr.includes('already exists'));
      const tables = await collisionPool.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename");
      check(tables.rows.length === 1 && tables.rows[0].tablename === 'media_requests');
      check((await collisionPool.query('SELECT sentinel FROM media_requests')).rows[0]?.sentinel === 42);
      return { targetPool, archiveSha256: checksum, archiveBytes, failedRestoreRolledBack: true };
    }
    result = await run({ sourcePool, dumpAndRestore, imageId, postgresVersion: Number(version) });
  } catch (error) { failure = error; }
  finally {
    if (!await closeRecoveryPools(pools)) failure ??= new Error('PostgreSQL rehearsal connections could not be closed');
    try {
      // A failed docker run may still have created the named container. Never
      // remove it until the per-run ownership label and exact name agree.
      const listed = creationAttempted
        ? await runDocker(['container', 'ls', '--all', '--filter', `label=${ownershipLabel}=${nonce}`, '--format', '{{.ID}}'])
        : { stdout: '' };
      if (listed.stdout.trim()) {
        const [owned] = JSON.parse((await runDocker(['container', 'inspect', name])).stdout);
        check(owned.Name === `/${name}` && owned.Config?.Labels?.[ownershipLabel] === nonce && /^[a-f0-9]{64}$/.test(owned.Id));
        if (containerId) check(owned.Id === containerId);
        await runDocker(['container', 'rm', '--force', '--volumes', owned.Id]);
      }
      const remaining = creationAttempted
        ? await runDocker(['container', 'ls', '--all', '--filter', `label=${ownershipLabel}=${nonce}`, '--format', '{{.ID}}'])
        : { stdout: '' };
      check(remaining.stdout.trim() === '');
      cleanupVerified = true;
    } catch { failure = new Error('Owned rehearsal container cleanup could not be verified'); }
  }
  if (failure) throw failure;
  return { ...result, cleanupVerified };
}
