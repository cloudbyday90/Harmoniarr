/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { createHash } from 'node:crypto';
import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { addCohortPhase, cohortCountNames, cohortEvidenceMarker, cohortRefusal,
  createCohortLines, createCohortPhases } from '../integration/postgres-cohort-evidence.js';

/** One invocation owns its bounded state; no stream listeners or event queue. */
export function createPostgresCohortAccumulator({ projectRoot = process.cwd() } = {}) {
  const phases = createCohortPhases();
  const digest = createHash('sha256');
  let caseEvents = 0;
  let summary;
  let closed = false;
  const streams = Object.fromEntries(['test:stdout', 'test:stderr'].map(name => [name, createCohortLines(line => {
    const marker = '[fixture-phase] ';
    if (line.startsWith(marker)) addCohortPhase(phases, JSON.parse(line.slice(marker.length)));
  })]));

  function write(event) {
    if (closed) throw cohortRefusal();
    try {
      const { type, data } = event;
      if (streams[type]) streams[type].write(data.message);
      if (type === 'test:pass' || type === 'test:fail') {
        if (++caseEvents > 10_000 || typeof data.name !== 'string' || data.name.length > 2048
          || !Number.isSafeInteger(data.nesting) || !Number.isSafeInteger(data.line) || !Number.isSafeInteger(data.column)
          || typeof data.file !== 'string') throw cohortRefusal();
        const file = relative(projectRoot, data.file.startsWith('file:') ? fileURLToPath(data.file) : data.file).replaceAll('\\', '/');
        digest.update(JSON.stringify([file, data.line, data.column, data.nesting, data.name,
          data.details?.type ?? 'test', type, data.skip !== undefined && data.skip !== false,
          data.todo !== undefined && data.todo !== false]) + '\n');
      }
      if (type === 'test:summary' && data.file === undefined) {
        if (summary) throw cohortRefusal();
        summary = { counts: Object.fromEntries(cohortCountNames.map(name => [name, data.counts[name]])), success: data.success };
      }
    } catch (error) {
      closed = true;
      throw error;
    }
  }

  function end() {
    if (closed) throw cohortRefusal();
    closed = true;
    for (const stream of Object.values(streams)) stream.end();
    if (!summary) throw cohortRefusal();
    return `${cohortEvidenceMarker}${JSON.stringify({ version: 1, ...summary, caseEvents, caseDigest: digest.digest('hex'), phases })}\n`;
  }

  return { write, end };
}
