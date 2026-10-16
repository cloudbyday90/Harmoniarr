/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { Writable } from 'node:stream';
import { runPostgresTestFile } from './postgres-file-process.js';
import { cohortEvidenceMarker, cohortRefusal, createCohortLines, validateCohortFileEvidence } from './postgres-cohort-evidence.js';

export async function runIntegrationTestFile({ stderr = process.stderr, runFile = runPostgresTestFile, ...options } = {}) {
  let evidence;
  const lines = createCohortLines(line => {
    if (!line.startsWith(cohortEvidenceMarker)) return;
    if (evidence) throw cohortRefusal();
    evidence = validateCohortFileEvidence(JSON.parse(line.slice(cohortEvidenceMarker.length)));
  });
  const capture = new Writable({ write(chunk, _encoding, callback) {
    try { lines.write(chunk); stderr.write(chunk, callback); } catch (error) { callback(error); }
  } });
  capture.on('error', () => {});
  const result = await runFile({ ...options, stderr: capture, cohortEvidence: true });
  lines.end();
  if (result.exitCode !== 0 || result.signal != null || !evidence) throw cohortRefusal();
  return { ...result, evidence };
}
