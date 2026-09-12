/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { candidatePaginationMigration, createCandidateSchemaChecks } from '../../scripts/docker-candidate-schema-checks.js';

const composeArgs = ['compose', '-f', 'isolated-compose.yaml', '-p', 'candidate-schema-test'];
const firstMigration = '20260901_000001_baseline.sql';
const dates = { created_at: '2026-09-11T00:00:00.000Z', updated_at: '2026-09-11T00:00:00.000Z' };
const indexNames = ['library_wanted_releases_created_id_idx', 'library_wanted_releases_user_created_id_idx'];

function createPackagedCommandFixture({ candidate = false } = {}) {
  const calls = [];
  let savedFixture = null;
  let mutate = (probe) => probe;
  let failure = null;
  async function runCommandFn(command) {
    calls.push(command);
    if (failure) throw failure;
    assert.equal(command.command, 'docker');
    assert.deepEqual(command.args.slice(0, composeArgs.length), composeArgs);
    assert.deepEqual(command.args.slice(composeArgs.length, composeArgs.length + 3), ['exec', '-T', 'harmoniarr']);
    assert.equal(command.timeoutMs, 30000);
    const args = command.args.slice(composeArgs.length + 3);
    if (args[0] === 'pg_dump' || args[0] === 'pg_restore') {
      assert.deepEqual(args.slice(1), ['--version']);
      return { exitCode: 0, stdout: `${args[0]} (PostgreSQL) 18.6\n`, stderr: '' };
    }
    if (args[0] === 'harmoniarrctl') {
      assert.deepEqual(args.slice(1), ['--help']);
      return { exitCode: 0, stdout: 'Usage: harmoniarrctl <group> <command> [options]\n', stderr: '' };
    }
    assert.deepEqual(args.slice(0, 3), ['node', '--input-type=module', '--eval']);
    assert.match(args[3], /import\('\/app\/server-dist\/migration-manifest.js'\)/);
    const payload = JSON.parse(args[4]);
    if (payload.seed) {
      assert.equal(savedFixture, null);
      savedFixture = payload.fixture;
    }
    if (payload.fixture) assert.deepEqual(payload.fixture, savedFixture);
    const filenames = [firstMigration, ...(candidate ? [candidatePaginationMigration] : [])];
    const manifest = filenames.map((filename, index) => ({ filename, migrationKey: filename.slice(0, 15), checksum: String(index + 1).repeat(64) }));
    const ledger = manifest.map((row, index) => ({ ...row, id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`, status: 'applied' }));
    const fixture = payload.fixture;
    const probe = {
      manifest, ledger,
      user: fixture ? { id: fixture.userId, username: fixture.username, password_hash: '!packaged-continuity-disabled!',
        role: 'requester', is_disabled: true, ...dates } : null,
      request: fixture ? { id: fixture.requestId, requested_by_user_id: fixture.userId, requested_for_user_id: fixture.userId,
        request_kind: 'release', request_state: 'needs_review', artist_name: 'Candidate continuity artist',
        release_title: 'Candidate continuity release', normalized_query: `candidate-continuity-${fixture.requestId}`,
        notes: 'Generated packaged upgrade continuity fixture', evidence: { fixture: 'docker-candidate-continuity', version: 1 }, ...dates } : null,
      indexes: candidate ? indexNames.map((name, index) => ({ name, tableName: 'library_wanted_releases', valid: true, ready: true,
        definition: `CREATE INDEX ${name} ON public.library_wanted_releases USING btree (${index ? 'app_user_id, ' : ''}created_at DESC, id DESC)` })) : [],
      identity: { database: 'harmoniarr', username: 'harmoniarr', postgresVersion: '180006' }, nodeVersion: 'v24.19.0',
    };
    return { exitCode: 0, stdout: JSON.stringify(mutate(probe)), stderr: '' };
  }
  return { calls, runCommandFn, upgrade() { candidate = true; },
    mutate(next) { mutate = next; }, fail(error) { failure = error; } };
}

test('packaged baseline and upgrade preserve a generated request and immutable old migration ledger', async () => {
  const runtime = createPackagedCommandFixture();
  const checks = createCandidateSchemaChecks({ runCommandFn: runtime.runCommandFn });
  const env = { HARMONIARR_IMAGE: 'local-test-image' };
  const baseline = await checks.checkPhase({ composeArgs, env, phase: 'baseline' });
  assert.equal(baseline.migrationCount, 1);
  assert.equal(baseline.indexesVerified, false);
  assert.equal(baseline.continuityRequestCount, 1);
  assert.equal(baseline.requestContinuityVerified, false);
  runtime.upgrade();
  const upgraded = await checks.checkPhase({ composeArgs, env, phase: 'upgraded' });
  assert.deepEqual(upgraded, {
    phase: 'upgraded', migrationCount: 2, migrationChecksumsVerified: true, indexesVerified: true, indexCount: 2,
    packagedToolsVerified: true, nodeVersion: 'v24.19.0', postgresVersion: 180006, pgDumpVersion: '18.6', pgRestoreVersion: '18.6',
    continuityVerified: true, requestContinuityVerified: true, continuityRequestCount: 1, migrationsAdded: 1,
  });
  assert.equal(runtime.calls.length, 8);
  assert.equal(runtime.calls.every((call) => call.env === env), true);
  assert.doesNotMatch(JSON.stringify(upgraded), /candidate-continuity|password_hash|requestId|username|checksum|SELECT/);
});

test('a patch release upgrade can retain the existing ledger while proving request continuity', async () => {
  const runtime = createPackagedCommandFixture({ candidate: true });
  const checks = createCandidateSchemaChecks({ runCommandFn: runtime.runCommandFn });
  const baseline = await checks.checkPhase({ composeArgs, phase: 'baseline' });
  const upgraded = await checks.checkPhase({ composeArgs, phase: 'upgraded' });
  assert.equal(upgraded.migrationCount, baseline.migrationCount);
  assert.equal(upgraded.migrationsAdded, 0);
  assert.equal(upgraded.migrationChecksumsVerified, true);
  assert.equal(upgraded.requestContinuityVerified, true);
  assert.equal(upgraded.indexesVerified, true);
});

test('fresh install and restart remain read-only and verify unchanged migration records without creating users', async () => {
  const runtime = createPackagedCommandFixture({ candidate: true });
  const checks = createCandidateSchemaChecks();
  const context = { composeArgs, runCommandFn: runtime.runCommandFn };
  const fresh = await checks.checkPhase({ ...context, phase: 'fresh-install' });
  const restart = await checks.checkPhase({ ...context, phase: 'existing-data-restart' });
  assert.equal(fresh.continuityRequestCount, 0);
  assert.equal(restart.continuityVerified, true);
  assert.equal(restart.requestContinuityVerified, false);
  assert.equal(restart.migrationsAdded, 0);
  for (const call of runtime.calls.filter((entry) => entry.args.includes('--eval'))) {
    const payload = JSON.parse(call.args.at(-1));
    assert.equal(payload.fixture, null);
    assert.equal(payload.seed, false);
  }
});

test('upgrade fails on old ledger rewrite, lost ownership, changed data, missing new migration, or wrong index', async () => {
  const mutations = [
    (probe) => { probe.ledger[0].id = '20000000-0000-4000-8000-000000000001'; },
    (probe) => { probe.ledger[0].checksum = 'a'.repeat(64); probe.manifest[0].checksum = 'a'.repeat(64); },
    (probe) => { probe.request.requested_for_user_id = '20000000-0000-4000-8000-000000000001'; },
    (probe) => { probe.request.notes = 'changed durable data'; },
    (probe) => { probe.request = null; },
    (probe) => { probe.ledger.pop(); probe.manifest.pop(); },
    (probe) => { probe.indexes[0].valid = false; },
    (probe) => { probe.indexes[0].definition = probe.indexes[0].definition.replace(' DESC', ''); },
    (probe) => { probe.indexes = []; },
    (probe) => { probe.indexes = [probe.indexes[0], probe.indexes[0]]; },
  ];
  for (const mutation of mutations) {
    const runtime = createPackagedCommandFixture();
    const checks = createCandidateSchemaChecks({ runCommandFn: runtime.runCommandFn });
    await checks.checkPhase({ composeArgs, phase: 'baseline' });
    runtime.upgrade();
    runtime.mutate((probe) => { mutation(probe); return probe; });
    await assert.rejects(checks.checkPhase({ composeArgs, phase: 'upgraded' }), { code: 'docker_candidate_schema_check_failed', phase: 'upgraded' });
  }
});

test('packaged manifest state and tools must be complete and failures never expose command diagnostics', async () => {
  for (const mutate of [
    (probe) => { probe.ledger[0].status = 'failed'; return probe; },
    (probe) => { probe.ledger[0].checksum = 'a'.repeat(64); return probe; },
    (probe) => { probe.manifest.push(probe.manifest[0]); probe.ledger.push(probe.ledger[0]); return probe; },
  ]) {
    const runtime = createPackagedCommandFixture({ candidate: true });
    runtime.mutate(mutate);
    const checks = createCandidateSchemaChecks({ runCommandFn: runtime.runCommandFn });
    await assert.rejects(checks.checkPhase({ composeArgs, phase: 'fresh-install' }), /no successful schema evidence/);
  }
  const runtime = createPackagedCommandFixture({ candidate: true });
  const checks = createCandidateSchemaChecks({ runCommandFn: async (command) => {
    if (command.args.includes('pg_restore')) throw new Error('private-env-secret raw database diagnostic');
    return runtime.runCommandFn(command);
  } });
  await assert.rejects(checks.checkPhase({ composeArgs, phase: 'fresh-install' }), (error) => (
    error.code === 'docker_candidate_schema_check_failed' && !JSON.stringify(error).includes('private-env-secret')
    && !error.message.includes('raw database diagnostic') && error.cause === undefined
  ));
});

test('phase checks reject missing baseline or a changed compose project before any commands execute', async () => {
  const runtime = createPackagedCommandFixture();
  const checks = createCandidateSchemaChecks({ runCommandFn: runtime.runCommandFn });
  await assert.rejects(checks.checkPhase({ composeArgs, phase: 'upgraded' }), /schema checks failed/);
  assert.equal(runtime.calls.length, 0);
  await checks.checkPhase({ composeArgs, phase: 'baseline' });
  const count = runtime.calls.length;
  await assert.rejects(checks.checkPhase({ composeArgs: [...composeArgs, 'other-project'], phase: 'upgraded' }), /schema checks failed/);
  assert.equal(runtime.calls.length, count);
});

test('same-major acceptance requires Node 24 and PostgreSQL 18 with patched candidate server and tools', async () => {
  for (const mutate of [
    (probe) => { probe.nodeVersion = 'v22.18.0'; return probe; },
    (probe) => { probe.nodeVersion = 'v25.1.0'; return probe; },
    (probe) => { probe.identity.postgresVersion = '170006'; return probe; },
    (probe) => { probe.identity.postgresVersion = '180005'; return probe; },
  ]) {
    const runtime = createPackagedCommandFixture({ candidate: true });
    runtime.mutate(mutate);
    const checks = createCandidateSchemaChecks({ runCommandFn: runtime.runCommandFn });
    await assert.rejects(checks.checkPhase({ composeArgs, phase: 'fresh-install' }), /schema checks failed/);
  }
  const runtime = createPackagedCommandFixture();
  runtime.mutate((probe) => { probe.identity.postgresVersion = '180003'; return probe; });
  const checks = createCandidateSchemaChecks({ runCommandFn: async (command) => {
    const result = await runtime.runCommandFn(command);
    return { ...result, stdout: result.stdout.replace('(PostgreSQL) 18.6', '(PostgreSQL) 18.3') };
  } });
  const baseline = await checks.checkPhase({ composeArgs, phase: 'baseline' });
  assert.equal(baseline.postgresVersion, 180003);
  assert.equal(baseline.pgDumpVersion, '18.3');
  runtime.upgrade();
  runtime.mutate((probe) => probe);
  await assert.rejects(checks.checkPhase({ composeArgs, phase: 'upgraded' }), /schema checks failed/);
});
