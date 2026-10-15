/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { StringDecoder } from 'node:string_decoder';

export const cohortEvidenceMarker = '[postgres-cohort-evidence] ';
export const cohortPhaseNames = Object.freeze(['container_start', 'container_stop', 'template_prepare', 'schema_prepare',
  'fixture_seed', 'scenario_work', 'database_create', 'database_drop', 'template_drop', 'database_register', 'database_release',
  'pool_close', 'admin_close']);
export const cohortCountNames = Object.freeze(['tests', 'suites', 'passed', 'failed', 'cancelled', 'skipped', 'todo', 'topLevel']);
export function cohortRefusal() {
  return Object.assign(new Error('PostgreSQL cohort evidence is incomplete or inconsistent'), { code: 'fixture_cohort_evidence_refused' });
}
export function createCohortPhases() {
  return Object.fromEntries(cohortPhaseNames.map(name => [name, { count: 0, failed: 0, durationMs: 0 }]));
}
export function addCohortPhase(phases, record) {
  if (!cohortPhaseNames.includes(record?.phase)) return;
  if (!['passed', 'failed', 'cancelled'].includes(record.outcome) || !Number.isFinite(record.durationMs)
    || record.durationMs < 0 || phases[record.phase].count >= 100_000) throw cohortRefusal();
  const total = phases[record.phase]; total.count++; total.durationMs += record.durationMs;
  if (record.outcome !== 'passed') total.failed++;
  if (!Number.isFinite(total.durationMs)) throw cohortRefusal();
}
export function mergeCohortPhases(target, source) {
  for (const name of cohortPhaseNames) for (const key of ['count', 'failed', 'durationMs']) target[name][key] += source[name][key];
}
/** Bounded UTF-8 framing; no raw line survives in the resulting report. */
export function createCohortLines(onLine) {
  const decoder = new StringDecoder('utf8'); let pending = '';
  function consume(text) {
    for (const character of text) {
      if (character === '\n') { onLine(pending.replace(/\r$/u, '')); pending = ''; }
      else { pending += character; if (pending.length > 65_536) throw cohortRefusal(); }
    }
  }
  return { write: chunk => consume(decoder.write(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))),
    end() { consume(decoder.end()); if (pending) { onLine(pending); pending = ''; } } };
}
export function validateCohortFileEvidence(value) {
  if (value?.version !== 1 || value.success !== true || !/^[a-f0-9]{64}$/u.test(value.caseDigest ?? '')
    || !Number.isSafeInteger(value.caseEvents) || value.caseEvents < 1 || value.caseEvents > 10_000) throw cohortRefusal();
  const counts = {};
  for (const name of cohortCountNames) {
    const number = value.counts?.[name];
    if (!Number.isSafeInteger(number) || number < 0 || number > 10_000) throw cohortRefusal();
    counts[name] = number;
  }
  if (counts.tests === 0 || counts.passed !== counts.tests || counts.failed || counts.cancelled || counts.skipped || counts.todo
    || value.caseEvents !== counts.tests + counts.suites) throw cohortRefusal();
  const phases = createCohortPhases();
  for (const name of cohortPhaseNames) {
    const row = value.phases?.[name];
    if (!Number.isSafeInteger(row?.count) || row.count < 0 || row.count > 100_000
      || !Number.isSafeInteger(row.failed) || row.failed < 0 || row.failed > row.count
      || !Number.isFinite(row.durationMs) || row.durationMs < 0) throw cohortRefusal();
    phases[name] = { count: row.count, failed: row.failed, durationMs: row.durationMs };
  }
  return { version: 1, success: true, caseDigest: value.caseDigest, caseEvents: value.caseEvents, counts, phases };
}
