/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { Writable } from 'node:stream';
import { performance } from 'node:perf_hooks';
import { relative } from 'node:path';
import { runPostgresTestFile } from './postgres-file-process.js';
import { runSharedPostgresTests } from './postgres-test-launcher.js';
import { resolvePostgresTestCohort } from './postgres-test-cohort.js';
import { createOwnedPostgresServer } from './owned-postgres-server.js';
import { createIntegrationFixturePhaseObserver } from './fixture-phase-observer.js';
import { createPostgresCohortEnvironment, fingerprintPostgresCohortSource, postgresCohortPlan } from './postgres-cohort-policy.js';
import { addCohortPhase, cohortEvidenceMarker, cohortPhaseNames, cohortRefusal, createCohortLines,
  createCohortPhases, mergeCohortPhases, validateCohortFileEvidence } from './postgres-cohort-evidence.js';

const varyingPhases = new Set(['container_start', 'container_stop', 'database_register', 'database_release']);
function signature(files) {
  return JSON.stringify([...files].sort((a, b) => a.file.localeCompare(b.file)).map(({ file, evidence }) =>
    [file, evidence.caseDigest, evidence.caseEvents, evidence.counts]));
}
function workSignature(phases) {
  return JSON.stringify(cohortPhaseNames.filter(name => !varyingPhases.has(name)).map(name =>
    [name, phases[name].count, phases[name].failed]));
}
export async function comparePostgresCohort({ cwd = process.cwd(), env = process.env, signal,
  stdout = process.stdout, stderr = process.stderr, onUpdate = async () => {},
  resolveFiles = resolvePostgresTestCohort, fingerprint = fingerprintPostgresCohortSource,
  runFile = runPostgresTestFile, runShared = runSharedPostgresTests, createServer = createOwnedPostgresServer } = {}) {
  if (signal?.aborted) throw signal.reason;
  const environment = createPostgresCohortEnvironment(env); const files = await resolveFiles({ cwd });
  if (files.length !== 5) throw cohortRefusal();
  const source = await fingerprint(cwd); const report = { version: 1, complete: false, source, samples: [] };
  let expectedCases; let expectedWork;
  try {
    for (const selection of postgresCohortPlan) {
      if (signal?.aborted) throw signal.reason;
      if (JSON.stringify(await fingerprint(cwd)) !== JSON.stringify(source)) throw cohortRefusal();
      const ordered = selection.order === 'forward' ? [...files] : [...files].reverse();
      const phases = createCohortPhases(); const outcomes = [];
      const measuredFile = async options => {
        let evidence;
        const lines = createCohortLines(line => {
          if (!line.startsWith(cohortEvidenceMarker)) return;
          if (evidence) throw cohortRefusal();
          evidence = validateCohortFileEvidence(JSON.parse(line.slice(cohortEvidenceMarker.length)));
        });
        const capture = new Writable({ write(chunk, _encoding, callback) {
          try { lines.write(chunk); stderr.write(chunk, callback); } catch (error) { callback(error); }
        } });
        // The write callback is the failure authority, including after the process adapter removes its listeners.
        capture.on('error', () => {});
        const result = await runFile({ ...options, stdout, stderr: capture, cohortEvidence: true });
        lines.end();
        if (result.exitCode !== 0 || result.signal != null || !evidence) throw cohortRefusal();
        mergeCohortPhases(phases, evidence.phases);
        outcomes.push({ file: relative(cwd, options.file).replaceAll('\\', '/'), durationMs: result.durationMs, evidence });
        return result;
      };
      const started = performance.now(); let ownership;
      if (selection.mode === 'shared') {
        ownership = await runShared({ cwd, env: environment, signal, stdout, stderr, resolveFiles: async () => ordered,
          runFile: measuredFile, createServer: options => createServer({ ...options,
            phaseObserver: createIntegrationFixturePhaseObserver({ env: environment, onRecord: record => addCohortPhase(phases, record) }) }) });
      } else {
        for (const file of ordered) await measuredFile({ file, cwd, env: environment, signal });
      }
      const durationMs = performance.now() - started;
      if (signal?.aborted) throw signal.reason;
      if (JSON.stringify(await fingerprint(cwd)) !== JSON.stringify(source)) throw cohortRefusal();
      if (outcomes.length !== 5 || !Number.isFinite(durationMs) || durationMs < 0) throw cohortRefusal();
      const servers = selection.mode === 'shared' ? 1 : 5;
      for (const phase of ['container_start', 'container_stop']) {
        if (phases[phase].count !== servers || phases[phase].failed) throw cohortRefusal();
      }
      if (!phases.database_create.count || phases.database_create.failed || phases.database_drop.failed || phases.template_drop.failed
        || phases.database_create.count !== phases.database_drop.count + phases.template_drop.count) throw cohortRefusal();
      if (ownership && (ownership.files !== 5 || ownership.completed !== 5 || ownership.registered !== ownership.released
        || ownership.reaped !== 0 || ownership.registered !== phases.database_create.count)) throw cohortRefusal();
      const cases = signature(outcomes); const work = workSignature(phases);
      expectedCases ??= cases; expectedWork ??= work;
      if (cases !== expectedCases || work !== expectedWork) throw cohortRefusal();
      report.samples.push({ ...selection, durationMs, files: outcomes, phases,
        ...(ownership ? { ownership: { registered: ownership.registered, released: ownership.released, reaped: ownership.reaped } } : {}) });
      await onUpdate(structuredClone(report));
    }
    report.pairs = ['forward', 'reverse'].map(order => {
      const isolated = report.samples.find(sample => sample.mode === 'isolated' && sample.order === order).durationMs;
      const shared = report.samples.find(sample => sample.mode === 'shared' && sample.order === order).durationMs;
      return { order, isolatedMs: isolated, sharedMs: shared, savingMs: isolated - shared,
        savingPercent: isolated === 0 ? null : 100 * (isolated - shared) / isolated };
    });
    report.complete = true; await onUpdate(structuredClone(report)); return report;
  } catch (error) {
    report.complete = false; report.failed = true; delete report.pairs;
    try { await onUpdate(structuredClone(report)); } catch { /* Keep the actual Error/null over artifact fallout. */ }
    throw error;
  }
}
