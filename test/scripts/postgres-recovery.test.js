/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createRecoveryDockerCommand } from '../../scripts/postgres-recovery-command.js';
import { assertLocalRecoveryDocker, closeRecoveryPools, verifyRecoveryContainer, withPostgresRecoveryRuntime } from '../../scripts/postgres-recovery-runtime.js';
import { buildPostgresRecoveryEvidence } from '../../scripts/postgres-recovery-evidence.js';
import { validatePostgresRecovery } from '../../scripts/postgres-recovery-validation.js';
import { parsePostgresRecoveryOptions, runPostgresRecoveryCommand } from '../../scripts/validate-postgres-recovery.js';

function fixtureResult() {
  return {
    imageId: `sha256:${'a'.repeat(64)}`, archiveSha256: 'b'.repeat(64), archiveBytes: 1024,
    postgresVersion: 180006, migrationCount: 97, anchorCount: 104,
    schemaPreserved: true, failedRestoreRolledBack: true, cleanupVerified: true,
    requests: {
      ledgerPreserved: true, ownershipPreserved: true, queuedRecoveryReused: true, continuationResumed: true,
      completedWorkPreserved: true, reviewedDecisionsPreserved: true, duplicateConstraintsVerified: true,
      retainedRunProtected: true, replayIdempotent: true, restoredRequestCount: 2, restoredCollectionCount: 2,
      restoredDecisionCount: 3, restoredProviderWorkCount: 9, restoredIntentCount: 1,
      restoredOperationRunCount: 6, restoredAuditEventCount: 12, finalizedCollectionCount: 2, resumedWorkCount: 4,
      providerNetworkRequests: 0, acquisitionOperationsExecuted: 0,
    },
    operations: {
      originalKeyDecrypts: true, missingKeyRejected: true, wrongKeyRejected: true, activeLeasePreserved: true,
      queuedWorkUnchanged: true, restoredRunCount: 5, restoredSecretCount: 1, expiredLeasesReleased: 2,
      cancelledRunCount: 2, retryQueuedCount: 1, workersStarted: false,
    },
  };
}

test('recovery evidence contains only allowlisted observations and rejects incomplete or unsafe passes', () => {
  const result = fixtureResult();
  result.password = 'secret-marker';
  result.requests.sourceUrl = 'secret-marker';
  result.operations.encryptionKey = 'secret-marker';
  const evidence = buildPostgresRecoveryEvidence(result);
  assert.equal(evidence.status, 'passed');
  assert.equal(evidence.evidenceType, 'generated_fixture_postgres_recovery');
  assert.equal(JSON.stringify(evidence).includes('secret-marker'), false);
  for (const changes of [
    { cleanupVerified: false }, { failedRestoreRolledBack: false }, { postgresVersion: 180003 },
    { archiveBytes: 0 }, { imageId: 'secret-marker' }, { migrationCount: Infinity },
    { requests: { ...result.requests, ledgerPreserved: false } },
    { requests: { ...result.requests, providerNetworkRequests: 1 } },
    { operations: { ...result.operations, workersStarted: true } },
    { operations: { ...result.operations, wrongKeyRejected: false } },
  ]) assert.throws(() => buildPostgresRecoveryEvidence({ ...result, ...changes }), /incomplete or invalid/);
});

test('recovery CLI accepts no production database, external archive, or credential arguments', () => {
  for (const option of ['--database-url', '--archive', '--container', '--password', '--image']) {
    assert.throws(() => parsePostgresRecoveryOptions([option, 'secret-marker']), (error) => (
      error.message === 'Unsupported PostgreSQL rehearsal options; use --help'
    ));
  }
  assert.deepEqual(parsePostgresRecoveryOptions(['--help']), { help: true });
  assert.throws(() => parsePostgresRecoveryOptions([]), /evidence-path is required/);
});

test('recovery CLI reserves new evidence before starting Docker and never overwrites an existing artifact', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'harmoniarr-pg-recovery-command-'));
  try {
    const evidencePath = join(workspace, 'evidence.json');
    let validations = 0;
    const validate = async () => { validations++; return buildPostgresRecoveryEvidence(fixtureResult()); };
    await runPostgresRecoveryCommand({ args: ['--evidence-path', evidencePath], validate });
    assert.equal(JSON.parse(await readFile(evidencePath, 'utf8')).status, 'passed');
    await assert.rejects(runPostgresRecoveryCommand({ args: ['--evidence-path', evidencePath], validate }), /new writable/);
    assert.equal(validations, 1);
    const failedPath = join(workspace, 'failed.json');
    await assert.rejects(runPostgresRecoveryCommand({ args: ['--evidence-path', failedPath], validate: async () => { throw new Error('secret-marker'); } }),
      (error) => !error.message.includes('secret-marker'));
    assert.equal(await readFile(failedPath, 'utf8'), '');
    await writeFile(join(workspace, 'existing.txt'), 'preserved');
  } finally { await rm(workspace, { recursive: true, force: true }); }
});

test('recovery command uses bounded shell-free hidden processes and never echoes rejected command output', async () => {
  const calls = [];
  const run = createRecoveryDockerCommand({ env: {}, execFileFn: async (...args) => {
    calls.push(args);
    if (args[1][0] === 'fail') throw Object.assign(new Error('secret-marker'), { code: 1, stderr: 'secret-marker' });
    return { stdout: 'done', stderr: '' };
  } });
  await run(['version'], { environment: { POSTGRES_PASSWORD: 'synthetic-password' } });
  assert.equal(calls[0][2].shell, false);
  assert.equal(calls[0][2].windowsHide, true);
  assert.equal(calls[0][2].maxBuffer, 1_048_576);
  assert.ok(calls[0][2].timeout > 0);
  assert.equal(JSON.stringify(calls[0][1]).includes('synthetic-password'), false);
  await assert.rejects(run(['fail']), (error) => !JSON.stringify({ ...error, message: error.message }).includes('secret-marker'));
});

test('recovery refuses remote Docker contexts and host overrides before fixture creation', async () => {
  for (const endpoint of ['ssh://remote.example', 'tcp://remote.example:2376', 'tcp://127.0.0.1:2375']) {
    await assert.rejects(assertLocalRecoveryDocker({ env: {}, runDocker: async () => ({ stdout: endpoint }) }), /safety contract/);
  }
  let calls = 0;
  await assert.rejects(assertLocalRecoveryDocker({ env: { DOCKER_HOST: 'tcp://remote.example:2375' }, runDocker: async () => { calls++; } }));
  assert.equal(calls, 0);
  for (const endpoint of ['unix:///var/run/docker.sock', 'npipe:////./pipe/dockerDesktopLinuxEngine']) {
    await assertLocalRecoveryDocker({ env: {}, runDocker: async () => ({ stdout: endpoint }) });
  }
});

function fixtureContainer() {
  return { Id: 'a'.repeat(64), Name: '/fixture', Image: `sha256:${'b'.repeat(64)}`,
    Config: { Labels: { 'io.harmoniarr.postgres-recovery': 'nonce' } }, Mounts: [],
    NetworkSettings: { Ports: { '5432/tcp': [{ HostIp: '127.0.0.1', HostPort: '54321' }] } } };
}

test('container identity, no-host-mount, and loopback invariants reject unexpected Docker state', () => {
  const identity = { nonce: 'nonce', name: 'fixture', containerId: 'a'.repeat(64) };
  assert.equal(verifyRecoveryContainer(fixtureContainer(), identity).port, 54321);
  for (const changes of [{ Id: 'b'.repeat(64) }, { Name: '/production' }, { Config: { Labels: {} } },
    { Mounts: [{ Type: 'bind', Source: 'secret-marker' }] },
    { NetworkSettings: { Ports: { '5432/tcp': [{ HostIp: '0.0.0.0', HostPort: '54321' }] } } }]) {
    assert.throws(() => verifyRecoveryContainer({ ...fixtureContainer(), ...changes }, identity), /safety contract/);
  }
});

test('pool shutdown deadlines include stalled, rejected, and synchronously failed close operations', async () => {
  assert.equal(await closeRecoveryPools([{ end: () => Promise.resolve() }]), true);
  assert.equal(await closeRecoveryPools([{ end: () => new Promise(() => {}) }], { timeoutMs: 5 }), false);
  assert.equal(await closeRecoveryPools([{ end: () => { throw new Error('secret-marker'); } }]), false);
});

function fakeRuntime({ alteredOwnership = false, closeFails = false } = {}) {
  let description;
  let created = false;
  let inspectCount = 0;
  const removals = [];
  const runDocker = async (args) => {
    if (args[0] === 'context') return { stdout: 'unix:///var/run/docker.sock' };
    if (args[0] === 'pull') return { stdout: '' };
    if (args[0] === 'run') {
      created = true;
      const name = args[args.indexOf('--name') + 1];
      const nonce = args[args.indexOf('--label') + 1].split('=')[1];
      description = { ...fixtureContainer(), Name: `/${name}`, Config: { Labels: { 'io.harmoniarr.postgres-recovery': nonce } } };
      return { stdout: description.Id };
    }
    if (args[1] === 'ls') return { stdout: created ? description.Id : '' };
    if (args[1] === 'inspect') {
      inspectCount++;
      return { stdout: JSON.stringify([{ ...description, ...(alteredOwnership && inspectCount > 1 ? { Config: { Labels: {} } } : {}) }]) };
    }
    if (args[1] === 'rm') { removals.push(args.at(-1)); created = false; return { stdout: '' }; }
    throw new Error('Unexpected fixture Docker command');
  };
  const createPoolFn = () => ({ on() {}, query: async () => ({ rows: [{ server_version_num: '180006' }] }),
    end: async () => { if (closeFails) throw new Error('fixture close failure'); } });
  return { runDocker, createPoolFn, removals };
}

test('runtime removes only its verified container after callback or connection-close failures', async () => {
  for (const closeFails of [false, true]) {
    const runtime = fakeRuntime({ closeFails });
    await assert.rejects(withPostgresRecoveryRuntime({ ...runtime, env: {}, run: async () => {
      if (!closeFails) throw new Error('fixture failure');
      return {};
    } }));
    assert.deepEqual(runtime.removals, ['a'.repeat(64)]);
  }
  const forged = fakeRuntime({ alteredOwnership: true });
  await assert.rejects(withPostgresRecoveryRuntime({ ...forged, env: {}, run: async () => ({}) }), /cleanup could not be verified/);
  assert.deepEqual(forged.removals, []);
});

test('validation errors report only the failed phase and omit SQL, credentials, and fixture identities', async () => {
  await assert.rejects(validatePostgresRecovery({ withRuntime: async () => { throw new Error('secret-marker'); } }), (error) => {
    assert.equal(error.phase, 'runtime');
    assert.equal(JSON.stringify({ ...error, message: error.message }).includes('secret-marker'), false);
    return true;
  });
});
