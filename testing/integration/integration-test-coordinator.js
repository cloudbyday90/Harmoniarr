/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { realpath } from 'node:fs/promises';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { createIntegrationTestPlan, discoverIntegrationTestFiles, integrationCoordinatorRefusal } from './integration-test-plan.js';
import { createIntegrationTestEnvironment } from './integration-test-environment.js';
import { preflightIntegrationTests } from './integration-test-preflight.js';
import { runIntegrationTestFile } from './integration-test-file.js';
import { runSharedPostgresTests } from './postgres-test-launcher.js';
import { cohortCountNames, validateCohortFileEvidence } from './postgres-cohort-evidence.js';

export async function runIntegrationTests({ cwd = process.cwd(), env = process.env, signal,
  stdout = process.stdout, stderr = process.stderr, onUpdate = async () => {},
  discoverFiles = discoverIntegrationTestFiles, preflight = preflightIntegrationTests,
  runShared = runSharedPostgresTests, runFile = runIntegrationTestFile } = {}) {
  if (signal?.aborted) throw signal.reason;
  let environment = createIntegrationTestEnvironment(env); const root = await realpath(cwd);
  const files = await discoverFiles({ cwd: root }); const plan = createIntegrationTestPlan(files);
  const started = performance.now(); const completed = new Set();
  const report = { version: 1, complete: false, failed: false, files: files.length, completed: 0,
    counts: Object.fromEntries(cohortCountNames.map(name => [name, 0])), outcomes: [] };
  async function publish(outcomes) {
    if (signal?.aborted) throw signal.reason;
    for (const outcome of outcomes) {
      if (completed.has(outcome.file)) throw integrationCoordinatorRefusal();
      completed.add(outcome.file); report.outcomes.push(outcome);
      for (const name of cohortCountNames) report.counts[name] += outcome.counts[name];
    }
    report.completed = completed.size; report.durationMs = Math.max(0, performance.now() - started);
    await onUpdate(structuredClone(report));
    if (signal?.aborted) throw signal.reason;
  }
  try {
    if (signal?.aborted) throw signal.reason;
    const prerequisites = await preflight({ env: environment, signal });
    environment = createIntegrationTestEnvironment(prerequisites.env); report.prerequisites = prerequisites.evidence;
    await publish([]);
    for (const step of plan) {
      if (signal?.aborted) throw signal.reason;
      const outcomes = []; let active = false;
      const execute = async options => {
        const file = step.files[outcomes.length];
        if (active || !file || options.file !== resolve(root, file)) throw integrationCoordinatorRefusal();
        active = true;
        try {
          if (signal?.aborted) throw signal.reason;
          const result = await runFile(options); const evidence = validateCohortFileEvidence(result.evidence);
          if (result.exitCode !== 0 || result.signal != null || !Number.isFinite(result.durationMs)
            || result.durationMs < 0) throw integrationCoordinatorRefusal();
          outcomes.push({ file, mode: step.mode, durationMs: result.durationMs,
            counts: evidence.counts, caseDigest: evidence.caseDigest });
          return result;
        } finally { active = false; }
      };
      if (step.mode === 'shared') {
        const ownership = await runShared({ cwd: root, env: { ...environment }, signal, stdout, stderr,
          resolveFiles: async () => step.files.map(file => resolve(root, file)), runFile: execute });
        if (active || ownership.files !== step.files.length || ownership.completed !== step.files.length
          || !Number.isSafeInteger(ownership.registered) || ownership.registered < 1
          || ownership.registered !== ownership.released || ownership.reaped !== 0) throw integrationCoordinatorRefusal();
        report.ownership = { registered: ownership.registered, released: ownership.released, reaped: ownership.reaped };
      } else await execute({ file: resolve(root, step.files[0]), cwd: root, env: { ...environment }, signal, stdout, stderr });
      if (outcomes.length !== step.files.length) throw integrationCoordinatorRefusal();
      await publish(outcomes);
    }
    if (completed.size !== files.length || files.some(file => !completed.has(file))) throw integrationCoordinatorRefusal();
    if (signal?.aborted) throw signal.reason;
    report.complete = true; await publish([]); return report;
  } catch (error) {
    report.complete = false; report.failed = true;
    try { await onUpdate(structuredClone(report)); } catch { /* Retain the original Error/null over sink failure. */ }
    throw error;
  }
}
