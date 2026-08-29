/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { browserRuntimeDiagnosticMarker } from '../../testing/browser/browser-runtime-diagnostic.js';
import {
  assertBrowserRuntimeDiagnosticEvidenceContract,
  createBrowserRuntimeDiagnosticEvidence,
  createBrowserRuntimeDiagnosticOutputCollector,
  getOptionalBrowserRuntimeDiagnosticEvidencePath,
  parseBrowserRuntimeDiagnosticEvidence,
  renderBrowserRuntimeDiagnosticSummary,
  writeBrowserRuntimeDiagnosticEvidence,
  writeBrowserRuntimeDiagnosticSummary,
} from '../../scripts/browser-runtime-diagnostic-evidence.js';

function createRecord({ scenarioCategory = 'artist_detail' } = {}) {
  return {
    error: {
      category: 'timeout',
      readinessTarget: 'heading',
    },
    network: {
      apiRequestCount: 2,
      apiRequestFailureCount: 0,
      apiResponseCount: 2,
      responseStatusCounts: {
        '2xx': 2,
        '3xx': 0,
        '4xx': 0,
        '5xx': 0,
        other: 0,
      },
    },
    page: {
      consoleErrorCount: 0,
      documentReadyState: 'complete',
      pageErrorCount: 0,
      routeCategory: 'artist_detail',
    },
    scenarioCategory,
    timing: {
      domContentLoadedMs: 110,
      elapsedMs: 30_000,
      loadMs: 190,
    },
  };
}

function createEvidence(overrides = {}) {
  return createBrowserRuntimeDiagnosticEvidence({
    browserTest: {
      durationMs: 250_000,
      status: 'failed',
      workerCount: 2,
    },
    generatedAt: '2026-08-29T00:00:00.000Z',
    records: [createRecord()],
    ...overrides,
  });
}

test('browser runtime diagnostic collector accepts split marked records and bounds excess records', () => {
  const record = createRecord();
  const collector = createBrowserRuntimeDiagnosticOutputCollector({ recordLimit: 1 });
  const encodedRecord = `${browserRuntimeDiagnosticMarker}${JSON.stringify(record)}\n`;

  collector.addChunk(`not diagnostic\n${encodedRecord.slice(0, 33)}`);
  collector.addChunk(`${encodedRecord.slice(33)}${encodedRecord}`);

  assert.deepEqual(collector.finish(), {
    discardedRecordCount: 1,
    invalidRecordCount: 0,
    records: [record],
  });
});

test('browser runtime diagnostic evidence is a bounded, workspace-local schema', async () => {
  const evidence = createEvidence();
  const writes = [];
  const result = await writeBrowserRuntimeDiagnosticEvidence({
    ...evidence,
    cwd: process.cwd(),
    evidencePath: 'artifacts/browser-runtime-diagnostic.json',
    mkdirFn: async () => {},
    writeFileFn: async (filePath, content, encoding) => writes.push({ content, encoding, filePath }),
  });

  assert.equal(getOptionalBrowserRuntimeDiagnosticEvidencePath({
    HARMONIARR_BROWSER_RUNTIME_DIAGNOSTIC_PATH: ' artifacts/browser-runtime-diagnostic.json ',
  }), 'artifacts/browser-runtime-diagnostic.json');
  assert.equal(result.evidencePath.includes('artifacts'), true);
  assert.equal(writes[0].encoding, 'utf8');
  assert.equal(writes[0].content.includes('Private Artist'), false);
  assert.throws(() => assertBrowserRuntimeDiagnosticEvidenceContract({
    ...evidence,
    records: [{
      ...createRecord(),
      page: {
        ...createRecord().page,
        url: 'http://private.example',
      },
    }],
  }), /url is not allowed/u);
});

test('browser runtime diagnostic evidence parsing and summary stay structured', async () => {
  const evidence = createEvidence({
    discardedRecordCount: 1,
    invalidRecordCount: 2,
  });
  const writes = [];

  assert.match(renderBrowserRuntimeDiagnosticSummary(evidence), /Bounded failed-scenario records: \*\*1\*\*/u);
  assert.match(renderBrowserRuntimeDiagnosticSummary(evidence), /timeout: 1/u);
  assert.throws(() => parseBrowserRuntimeDiagnosticEvidence('{not-json'), /must be valid JSON/u);
  await writeBrowserRuntimeDiagnosticSummary({
    appendFileFn: async (filePath, content) => writes.push({ content, filePath }),
    cwd: process.cwd(),
    evidencePath: 'artifacts/browser-runtime-diagnostic.json',
    readFileFn: async () => JSON.stringify(evidence),
    summaryPath: 'artifacts/summary.md',
  });

  assert.deepEqual(writes.map(({ filePath }) => filePath), ['artifacts/summary.md']);
  assert.match(writes[0].content, /Discarded records: \*\*1\*\*; invalid records: \*\*2\*\*/u);
});
