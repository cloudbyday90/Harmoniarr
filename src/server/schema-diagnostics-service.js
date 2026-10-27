/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { startDatabaseSchemaDriftInspection } from './schema-drift-service.js';
import { startSchemaDiagnosticTask } from './schema-diagnostic-task-service.js';

export function unavailableSchemaDiagnostics(state = 'unavailable') {
  return { state, checkedAt: null, lineage: null, anchors: null };
}

/** Explicit field projection for the administrator HTTP summary. No raw diagnostic details. */
export function projectSchemaDiagnostics(report, checkedAt) {
  const { lineage, anchors } = report;
  if (!['current', 'not_current', 'unavailable'].includes(lineage?.state)
    || !['current', 'drift'].includes(anchors?.state) || !Array.isArray(anchors.missing) || !Array.isArray(anchors.altered)) throw new Error('Invalid schema observation');
  const count = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
  if (count(anchors.checkedCount) === null || anchors.checkedCount < 1 || count(lineage.expectedRows) === null
    || count(lineage.observedRows) === null || anchors.missing.length + anchors.altered.length > anchors.checkedCount) throw new Error('Invalid schema observation counts');
  if (report.current === true && (lineage.expectedRows < 1 || lineage.observedRows !== lineage.expectedRows
    || anchors.missing.length || anchors.altered.length)) throw new Error('Inconsistent schema observation');
  return { state: report.current === true && lineage.state === 'current' && anchors.state === 'current' ? 'current' : 'attention', checkedAt,
    lineage: { state: lineage.state, expectedRows: count(lineage.expectedRows), observedRows: count(lineage.observedRows),
      incomplete: lineage.reason === 'row_limit_exceeded', pendingCount: count(lineage.pendingCount),
      unknownAppliedCount: count(lineage.unknownAppliedCount), checksumDriftCount: count(lineage.checksumDriftCount),
      migrationKeyDriftCount: count(lineage.migrationKeyDriftCount), nonAppliedCount: count(lineage.nonAppliedCount) },
    anchors: { state: anchors.state, checkedCount: count(anchors.checkedCount), missingCount: anchors.missing.length, alteredCount: anchors.altered.length } };
}

export function createSchemaDiagnosticsService({ inspectFn, now = () => new Date(), timeoutMs } = {}) {
  let running = false;
  return { async getSchemaDiagnostics({ signal } = {}) {
    if (running) return unavailableSchemaDiagnostics('busy');
    running = true;
    let task;
    try {
      const options = { signal, timeoutMs };
      task = inspectFn ? startSchemaDiagnosticTask(scope => inspectFn(scope), options) : startDatabaseSchemaDriftInspection(options);
      task.drained.then(safeToReadmit => { if (safeToReadmit) running = false; });
      return projectSchemaDiagnostics(await task.result, now().toISOString());
    }
    catch (error) { return unavailableSchemaDiagnostics(error?.code === 'schema_observation_busy' ? 'busy' : 'unavailable'); }
    finally { if (!task) running = false; }
  } };
}
