/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { verifyNotificationContinuity } from './docker-candidate-notification-continuity.js';
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { runBufferedCommand } from './process-runtime.js';
import { createPackagedCandidateSchemaProbeSource } from './docker-candidate-schema-probe.js';

export const candidatePaginationMigration = '20260911_103324_missing_music_keyset_paging_indexes.sql';
export const candidateNotificationMigration = '20260913_111021_index_invalidated_push_subscription_pruning.sql';
export const candidateIndexDefinitions = Object.freeze({
  library_wanted_releases_created_id_idx: 'CREATE INDEX library_wanted_releases_created_id_idx ON public.library_wanted_releases USING btree (created_at DESC, id DESC)',
  library_wanted_releases_user_created_id_idx: 'CREATE INDEX library_wanted_releases_user_created_id_idx ON public.library_wanted_releases USING btree (app_user_id, created_at DESC, id DESC)',
  notification_queue_pending_expiry_idx: "CREATE INDEX notification_queue_pending_expiry_idx ON public.notification_queue USING btree (expires_at, id) WHERE ((status = 'pending'::text) AND (claim_token IS NULL))",
  notification_queue_subscription_reference_idx: 'CREATE INDEX notification_queue_subscription_reference_idx ON public.notification_queue USING btree (subscription_id) WHERE (subscription_id IS NOT NULL)',
  notification_queue_terminal_retention_idx: "CREATE INDEX notification_queue_terminal_retention_idx ON public.notification_queue USING btree (terminal_at, id) WHERE ((status = ANY (ARRAY['sent'::text, 'failed'::text, 'expired'::text])) AND (claim_token IS NULL))",
  user_push_subscriptions_invalidated_pruning_idx: 'CREATE INDEX user_push_subscriptions_invalidated_pruning_idx ON public.user_push_subscriptions USING btree (invalidated_at, id) WHERE (invalidated_at IS NOT NULL)',

});
const phases = new Set(['fresh-install', 'existing-data-restart', 'baseline', 'upgraded']);
const uuidPattern = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const checksumPattern = /^[a-f0-9]{64}$/;
const migrationPattern = /^\d{8}_\d{6}_[a-z0-9_]+\.sql$/;
const platformNodeMajor = 24;
const platformPostgresMajor = 18;
const minimumCandidatePostgresVersion = 180006;

function check(condition) {
  if (!condition) throw new Error('Candidate schema acceptance contract was not satisfied');
}

function verifyManifest(probe) {
  check(Array.isArray(probe.manifest) && Array.isArray(probe.ledger)
    && probe.manifest.length > 0 && probe.manifest.length <= 2000 && probe.manifest.length === probe.ledger.length);
  const manifest = new Map();
  for (const row of probe.manifest) {
    check(migrationPattern.test(row.filename) && checksumPattern.test(row.checksum)
      && row.migrationKey === row.filename.slice(0, 15) && !manifest.has(row.filename));
    manifest.set(row.filename, row);
  }
  const seen = new Set();
  for (const row of probe.ledger) {
    const expected = manifest.get(row.filename);
    check(expected && row.status === 'applied' && uuidPattern.test(row.id)
      && row.checksum === expected.checksum && row.migrationKey === expected.migrationKey && !seen.has(row.filename));
    seen.add(row.filename);
  }
}

function verifyFixture(probe, fixture) {
  check(probe.user?.id === fixture.userId && probe.user.username === fixture.username && probe.user.is_disabled === true
    && probe.request?.id === fixture.requestId && probe.request.requested_by_user_id === fixture.userId
    && (!Object.hasOwn(probe.request, 'requested_for_user_id') || probe.request.requested_for_user_id === fixture.userId)
    && probe.request.request_kind === 'release' && probe.request.request_state === 'needs_review'
    && probe.request.evidence?.fixture === 'docker-candidate-continuity');
}

function verifyPreservation(previous, probe, fixture) {
  const ledger = new Map(probe.ledger.map((row) => [row.filename, row]));
  for (const row of previous.ledger) check(isDeepStrictEqual(ledger.get(row.filename), row));
  if (fixture) {
    check(isDeepStrictEqual(probe.user, previous.user));
    // Older schemas may gain new request columns on upgrade. Every captured
    // durable field must remain unchanged; a newly added target must be ours.
    for (const key of Object.keys(previous.request)) check(isDeepStrictEqual(probe.request[key], previous.request[key]));
  }
  check(probe.identity.database === previous.identity.database && probe.identity.username === previous.identity.username);
}

function toolVersion(stdout, tool) {
  const match = new RegExp(`^${tool} \\(PostgreSQL\\) (\\d+\\.\\d+)(?:\\.\\d+)?(?:[ \\r\\n]|$)`).exec(stdout);
  check(match);
  return match[1];
}

export function createCandidateSchemaChecks({
  runCommandFn = runBufferedCommand,
  expectedMigrationFilename = candidateNotificationMigration,
  expectedIndexDefinitions = candidateIndexDefinitions,
} = {}) {
  check(migrationPattern.test(expectedMigrationFilename));
  const indexNames = Object.keys(expectedIndexDefinitions);
  check(indexNames.length > 0 && indexNames.length <= 20
    && indexNames.every((name) => /^[a-z][a-z0-9_]+$/.test(name) && typeof expectedIndexDefinitions[name] === 'string'));
  const snapshots = new Map();
  let busy = false;

  async function checkPhase({ composeArgs, env, phase, runCommandFn: suppliedRunCommandFn } = {}) {
    let acquired = false;
    try {
      check(phases.has(phase) && !busy && Array.isArray(composeArgs)
        && composeArgs[0] === 'compose' && composeArgs.every((part) => typeof part === 'string'));
      busy = true;
      acquired = true;
      const initialPhase = phase === 'upgraded' ? 'baseline' : phase === 'existing-data-restart' ? 'fresh-install' : phase;
      const seed = initialPhase === phase;
      const previous = snapshots.get(initialPhase);
      check(seed ? !previous : Boolean(previous));
      const composeIdentity = JSON.stringify(composeArgs);
      check(seed || previous.composeIdentity === composeIdentity);
      const fixture = seed
        ? { userId: randomUUID(), requestId: randomUUID(), username: `candidate-${randomUUID()}`, subscriptionId: randomUUID(),
          notificationIds: Object.fromEntries(['pending', 'sent', 'failed', 'expired'].map((status) => [status, randomUUID()])) }
        : previous?.fixture ?? null;
      const execute = async (args) => {
        const result = await (suppliedRunCommandFn ?? runCommandFn)({ command: 'docker',
          args: [...composeArgs, 'exec', '-T', 'harmoniarr', ...args], env,
          expectedExitCodes: [0], timeoutMs: 30000 });
        check(result.exitCode === 0 && typeof result.stdout === 'string' && result.stdout.length <= 2_000_000);
        return result.stdout;
      };
      const source = createPackagedCandidateSchemaProbeSource();
      const probe = JSON.parse(await execute(['node', '--input-type=module', '--eval', source,
        JSON.stringify({ fixture, seed, indexNames })]));
      verifyManifest(probe);
      if (fixture) verifyFixture(probe, fixture);
      const notificationSchemaVerified = verifyNotificationContinuity({ probe, previous: previous?.probe, fixture, requireCurrent: phase !== 'baseline' });
      check(/^v\d+\.\d+\.\d+$/.test(probe.nodeVersion) && /^\d{6}$/.test(probe.identity?.postgresVersion));
      const postgresVersion = Number(probe.identity.postgresVersion);
      check(Number(probe.nodeVersion.slice(1).split('.')[0]) === platformNodeMajor
        && Math.floor(postgresVersion / 10000) === platformPostgresMajor
        && (phase === 'baseline' || postgresVersion >= minimumCandidatePostgresVersion));
      let added = 0;
      if (!seed) {
        verifyPreservation(previous.probe, probe, fixture);
        added = probe.ledger.length - previous.probe.ledger.length;
        check(phase === 'upgraded' ? added >= 0 : added === 0);
      }
      if (phase !== 'baseline') {
        check(probe.ledger.some((row) => row.filename === expectedMigrationFilename));
        check(Array.isArray(probe.indexes) && probe.indexes.length === indexNames.length
          && new Set(probe.indexes.map((index) => index.name)).size === indexNames.length);
        for (const index of probe.indexes) check(index.valid === true && index.ready === true
          && index.tableName === / ON public\.([a-z_]+)/.exec(expectedIndexDefinitions[index.name])?.[1]
          && index.definition === expectedIndexDefinitions[index.name]);
      }
      const dumpVersion = toolVersion(await execute(['pg_dump', '--version']), 'pg_dump');
      const restoreVersion = toolVersion(await execute(['pg_restore', '--version']), 'pg_restore');
      const [toolMajor, toolMinor] = dumpVersion.split('.').map(Number);
      check(dumpVersion === restoreVersion && toolMajor === platformPostgresMajor
        && (phase === 'baseline' || toolMajor * 10000 + toolMinor >= minimumCandidatePostgresVersion));
      check((await execute(['harmoniarrctl', '--help'])).includes('Usage: harmoniarrctl <group> <command> [options]'));
      if (seed) snapshots.set(initialPhase, { fixture, composeIdentity, probe });
      return { phase, migrationCount: probe.ledger.length, migrationChecksumsVerified: true,
        indexesVerified: phase !== 'baseline', indexCount: phase === 'baseline' ? 0 : indexNames.length,
        packagedToolsVerified: true, nodeVersion: probe.nodeVersion, postgresVersion,
        pgDumpVersion: dumpVersion, pgRestoreVersion: restoreVersion,
        continuityVerified: !seed, requestContinuityVerified: !seed,
        continuityRequestCount: 1, notificationSchemaVerified, notificationContinuityVerified: !seed,
        continuityNotificationCount: 4, continuitySubscriptionCount: 1, migrationsAdded: added };
    } catch {
      throw Object.assign(new Error('Packaged candidate schema checks failed; no successful schema evidence was produced'),
        { code: 'docker_candidate_schema_check_failed', phase: phases.has(phase) ? phase : 'invalid' });
    } finally { if (acquired) busy = false; }
  }
  return { checkPhase };
}
