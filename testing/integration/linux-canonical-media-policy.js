/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { resolveIntegrationTestRuntimeConfig } from './runtime-config.js';
import { mediaTransportPhases } from './media-transport-phase-policy.js';

export const linuxCanonicalMediaError = () => Object.assign(new Error('Linux canonical media validation refused incomplete evidence'),
  { code: 'fixture_linux_canonical_media_refused' });

export function resolveLinuxCanonicalMediaEnvironment({ env, platform, nodeVersion }) {
  const config = resolveIntegrationTestRuntimeConfig(env);
  if (platform !== 'linux' || !/^v24\./u.test(nodeVersion)
    || !/^sha256:[a-f0-9]{64}$/u.test(env.HARMONIARR_INTEGRATION_MEDIA_IMAGE ?? '')
    || ['PGPASSWORD', 'POSTGRES_PASSWORD', 'HARMONIARR_TEST_PG_MODE', 'HARMONIARR_TEST_PG_ENDPOINT', 'HARMONIARR_TEST_PG_TOKEN'].some(key => env[key])
    || config.useContainerReuse || config.poolMax !== 2 || config.poolConnectionTimeoutMs !== 10_000
    || config.scenarioTimeoutMs !== 90_000 || config.postgresImage !== 'postgres:18-alpine'
    || (env.HARMONIARR_LIBRARY_ADD_MEDIA_EXECUTION && env.HARMONIARR_LIBRARY_ADD_MEDIA_EXECUTION !== 'owned-api')
    || (env.HARMONIARR_LIBRARY_ADD_MEDIA_DIAGNOSTICS && env.HARMONIARR_LIBRARY_ADD_MEDIA_DIAGNOSTICS !== 'on')) throw linuxCanonicalMediaError();
  return { ...env, HARMONIARR_LIBRARY_ADD_MEDIA_EXECUTION: 'owned-api', HARMONIARR_LIBRARY_ADD_MEDIA_DIAGNOSTICS: 'on' };
}

/** Bounded native events; no private test output is forwarded into the public result. */
export function createLinuxCanonicalMediaEvidence() {
  const expected = [[1, 4], [0, 0], [0, 0], [0, 0], [3, 11], [4, 12]];
  let records = 0; let summary; let summaries = 0; let tail = ''; let bytes = 0; let failed = false;
  function line(value) {
    if (!value.startsWith('Library-add media: ')) return;
    const record = JSON.parse(value.slice(19)); const pair = expected[records++];
    const phases = record?.transport?.phases;
    if (!pair || record.mode !== 'owned-api' || record.generations !== pair[0] || record.inspections !== pair[1]
      || record.ownerCleanupSafe !== true || record.transport?.version !== 2 || record.transport.clipped !== false
      || !Array.isArray(phases) || phases.length !== mediaTransportPhases.length) throw linuxCanonicalMediaError();
    for (const [index, phase] of phases.entries()) {
      const expectedCount = !pair[1] || phase.phase === 'reader_context' ? 0
        : ['command_exec', 'command_inspect_before', 'command_inspect_after'].includes(phase.phase) ? pair[1]
          : phase.phase === 'start_inspect' ? 2 : 1;
      if (phase.phase !== mediaTransportPhases[index] || !Number.isSafeInteger(phase.started) || phase.started < 0
        || phase.started !== expectedCount
        || phase.completed !== phase.started || phase.failed !== 0 || phase.pending !== 0
        || phase.untimed !== 0 || phase.timed !== phase.completed) throw linuxCanonicalMediaError();
    }
    const count = phase => phases.find(row => row.phase === phase).completed;
    const owners = pair[1] ? 1 : 0;
    if (count('command_exec') !== pair[1] || count('owner_create') !== owners || count('owner_remove') !== owners) throw linuxCanonicalMediaError();
  }
  function accept(event) {
    if (event.type === 'test:fail') failed = true;
    if (event.type === 'test:summary' && event.data.file === undefined) { summaries++; summary = event.data; }
    if (event.type !== 'test:stdout') return;
    const chunk = event.data.message;
    if (typeof chunk !== 'string' || (bytes += Buffer.byteLength(chunk)) > 1024 * 1024) throw linuxCanonicalMediaError();
    tail += chunk;
    let end;
    while ((end = tail.indexOf('\n')) !== -1) {
      if (end > 16 * 1024) throw linuxCanonicalMediaError();
      line(tail.slice(0, end).replace(/\r$/u, '')); tail = tail.slice(end + 1);
    }
    if (tail.length > 16 * 1024) throw linuxCanonicalMediaError();
  }
  function observe(event) {
    if (failed) return;
    try { accept(event); }
    catch (error) { failed = true; tail = ''; throw error; }
  }
  function finish() {
    if (tail) line(tail);
    const counts = summary?.counts;
    if (failed || summaries !== 1 || summary?.success !== true || records !== 6 || counts?.tests !== 6
      || counts.passed !== 6 || counts.suites !== 1 || counts.failed !== 0 || counts.cancelled !== 0
      || counts.skipped !== 0 || counts.todo !== 0) throw linuxCanonicalMediaError();
    return { tests: 6, skipped: 0, generations: 8, inspections: 27, ownersCreated: 3, ownersRemoved: 3, ownerCleanupSafe: true };
  }
  return Object.freeze({ observe, finish });
}
