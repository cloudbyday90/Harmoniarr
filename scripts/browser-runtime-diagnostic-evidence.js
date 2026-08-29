/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import {
  browserRuntimeDiagnosticContract,
  browserRuntimeDiagnosticMarker,
} from '../testing/browser/browser-runtime-diagnostic.js';
import { resolveBrowserTestEvidencePath } from './browser-test-evidence.js';
import { normalizeOptionalString } from './script-input-resolution.js';

export const browserRuntimeDiagnosticEvidencePathEnvVar = 'HARMONIARR_BROWSER_RUNTIME_DIAGNOSTIC_PATH';
export const browserRuntimeDiagnosticSummaryPathEnvVar = 'HARMONIARR_BROWSER_RUNTIME_DIAGNOSTIC_SUMMARY_PATH';
export const defaultBrowserRuntimeDiagnosticRecordLimit = 50;

const browserRuntimeDiagnosticSchemaVersion = 1;
const diagnosticErrorCategories = new Set(['assertion', 'navigation', 'other', 'timeout']);
const diagnosticReadinessTargetCategories = new Set(['button', 'client_navigation', 'heading', 'other', 'text']);
const diagnosticRouteCategories = new Set([
  'acquisition',
  'artist_detail',
  'discover',
  'home',
  'import_review',
  'missing_music',
  'other',
  'request_detail',
  'settings',
  'unknown',
]);
const diagnosticDocumentReadyStates = new Set(['complete', 'interactive', 'loading', 'unknown']);
const diagnosticStatusFamilies = new Set(['2xx', '3xx', '4xx', '5xx', 'other']);
const maximumDiagnosticCounter = 1_000_000;
const maximumDiagnosticDurationMs = 3_600_000;

function assertObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function assertOnlyAllowedFields(value, allowedFields, label) {
  assertObject(value, label);

  for (const field of Object.keys(value)) {
    if (!allowedFields.has(field)) {
      throw new Error(`${label}.${field} is not allowed in browser runtime diagnostic evidence`);
    }
  }
}

function assertBoundedNonNegativeInteger(value, label, maximum = maximumDiagnosticCounter) {
  if (!Number.isSafeInteger(value) || value < 0 || value > maximum) {
    throw new Error(`${label} must be a non-negative integer no greater than ${maximum}`);
  }
}

function assertPositiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive integer`);
  }
}

function assertIsoTimestamp(value, label) {
  if (typeof value !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(value)
    || Number.isNaN(Date.parse(value))) {
    throw new Error(`${label} must be an ISO timestamp`);
  }
}

function assertEnum(value, allowedValues, label) {
  if (!allowedValues.has(value)) {
    throw new Error(`${label} must be one of: ${[...allowedValues].join(', ')}`);
  }
}

function assertNullableDuration(value, label) {
  if (value === null) {
    return;
  }

  assertBoundedNonNegativeInteger(value, label, maximumDiagnosticDurationMs);
}

function assertBrowserTestSection(browserTest) {
  assertOnlyAllowedFields(browserTest, new Set(['durationMs', 'status', 'workerCount']), 'browser runtime diagnostic evidence.browserTest');
  assertBoundedNonNegativeInteger(browserTest.durationMs, 'browser runtime diagnostic evidence.browserTest.durationMs', maximumDiagnosticDurationMs);
  assertEnum(browserTest.status, new Set(['failed', 'passed']), 'browser runtime diagnostic evidence.browserTest.status');
  assertPositiveInteger(browserTest.workerCount, 'browser runtime diagnostic evidence.browserTest.workerCount');
}

function assertResponseStatusCounts(responseStatusCounts) {
  assertOnlyAllowedFields(responseStatusCounts, diagnosticStatusFamilies, 'browser runtime diagnostic evidence.records.network.responseStatusCounts');

  for (const statusFamily of diagnosticStatusFamilies) {
    assertBoundedNonNegativeInteger(
      responseStatusCounts[statusFamily],
      `browser runtime diagnostic evidence.records.network.responseStatusCounts.${statusFamily}`,
    );
  }
}

function assertDiagnosticRecord(record) {
  assertOnlyAllowedFields(record, new Set(['error', 'network', 'page', 'scenarioCategory', 'timing']), 'browser runtime diagnostic evidence.records');

  assertOnlyAllowedFields(record.error, new Set(['category', 'readinessTarget']), 'browser runtime diagnostic evidence.records.error');
  assertEnum(record.error.category, diagnosticErrorCategories, 'browser runtime diagnostic evidence.records.error.category');
  assertEnum(record.error.readinessTarget, diagnosticReadinessTargetCategories, 'browser runtime diagnostic evidence.records.error.readinessTarget');

  assertOnlyAllowedFields(record.network, new Set([
    'apiRequestCount',
    'apiRequestFailureCount',
    'apiResponseCount',
    'responseStatusCounts',
  ]), 'browser runtime diagnostic evidence.records.network');
  assertBoundedNonNegativeInteger(record.network.apiRequestCount, 'browser runtime diagnostic evidence.records.network.apiRequestCount');
  assertBoundedNonNegativeInteger(record.network.apiRequestFailureCount, 'browser runtime diagnostic evidence.records.network.apiRequestFailureCount');
  assertBoundedNonNegativeInteger(record.network.apiResponseCount, 'browser runtime diagnostic evidence.records.network.apiResponseCount');
  assertResponseStatusCounts(record.network.responseStatusCounts);

  assertOnlyAllowedFields(record.page, new Set([
    'consoleErrorCount',
    'documentReadyState',
    'pageErrorCount',
    'routeCategory',
  ]), 'browser runtime diagnostic evidence.records.page');
  assertBoundedNonNegativeInteger(record.page.consoleErrorCount, 'browser runtime diagnostic evidence.records.page.consoleErrorCount');
  assertEnum(record.page.documentReadyState, diagnosticDocumentReadyStates, 'browser runtime diagnostic evidence.records.page.documentReadyState');
  assertBoundedNonNegativeInteger(record.page.pageErrorCount, 'browser runtime diagnostic evidence.records.page.pageErrorCount');
  assertEnum(record.page.routeCategory, diagnosticRouteCategories, 'browser runtime diagnostic evidence.records.page.routeCategory');

  assertEnum(record.scenarioCategory, new Set(browserRuntimeDiagnosticContract.diagnosticScenarioCategories), 'browser runtime diagnostic evidence.records.scenarioCategory');

  assertOnlyAllowedFields(record.timing, new Set(['domContentLoadedMs', 'elapsedMs', 'loadMs']), 'browser runtime diagnostic evidence.records.timing');
  assertNullableDuration(record.timing.domContentLoadedMs, 'browser runtime diagnostic evidence.records.timing.domContentLoadedMs');
  assertBoundedNonNegativeInteger(record.timing.elapsedMs, 'browser runtime diagnostic evidence.records.timing.elapsedMs', maximumDiagnosticDurationMs);
  assertNullableDuration(record.timing.loadMs, 'browser runtime diagnostic evidence.records.timing.loadMs');
}

function normalizeEvidencePath(value) {
  return normalizeOptionalString(value) || null;
}

function parseBrowserRuntimeDiagnosticLine(line) {
  const markerIndex = line.indexOf(browserRuntimeDiagnosticMarker);

  if (markerIndex < 0) {
    return null;
  }

  const encodedRecord = line.slice(markerIndex + browserRuntimeDiagnosticMarker.length).trim();
  if (!encodedRecord) {
    return { status: 'invalid' };
  }

  try {
    return {
      record: assertBrowserRuntimeDiagnosticRecord(JSON.parse(encodedRecord)),
      status: 'valid',
    };
  } catch {
    return { status: 'invalid' };
  }
}

function createRecordCollector(recordLimit) {
  const records = [];
  let discardedRecordCount = 0;
  let invalidRecordCount = 0;
  let pendingLine = '';

  function consumeLine(line) {
    const parsedLine = parseBrowserRuntimeDiagnosticLine(line);
    if (!parsedLine) {
      return;
    }

    if (parsedLine.status === 'invalid') {
      invalidRecordCount += 1;
      return;
    }

    if (records.length >= recordLimit) {
      discardedRecordCount += 1;
      return;
    }

    records.push(parsedLine.record);
  }

  return {
    addChunk(chunk) {
      pendingLine += String(chunk ?? '');
      const lines = pendingLine.split(/\r?\n/u);
      pendingLine = lines.pop() ?? '';
      lines.forEach(consumeLine);
    },
    finish() {
      if (pendingLine) {
        consumeLine(pendingLine);
        pendingLine = '';
      }

      return {
        discardedRecordCount,
        invalidRecordCount,
        records: [...records],
      };
    },
  };
}

export function getOptionalBrowserRuntimeDiagnosticEvidencePath(env = process.env) {
  return normalizeEvidencePath(env?.[browserRuntimeDiagnosticEvidencePathEnvVar]);
}

export function createBrowserRuntimeDiagnosticOutputCollector({
  recordLimit = defaultBrowserRuntimeDiagnosticRecordLimit,
} = {}) {
  assertPositiveInteger(recordLimit, 'browser runtime diagnostic record limit');

  if (recordLimit > defaultBrowserRuntimeDiagnosticRecordLimit) {
    throw new Error(`browser runtime diagnostic record limit must not exceed ${defaultBrowserRuntimeDiagnosticRecordLimit}`);
  }

  return createRecordCollector(recordLimit);
}

export function createBrowserRuntimeDiagnosticEvidence({
  browserTest,
  discardedRecordCount = 0,
  generatedAt = new Date().toISOString(),
  invalidRecordCount = 0,
  records = [],
} = {}) {
  assertBrowserTestSection(browserTest);
  assertBoundedNonNegativeInteger(discardedRecordCount, 'browser runtime diagnostic evidence.discardedRecordCount');
  assertIsoTimestamp(generatedAt, 'browser runtime diagnostic evidence.generatedAt');
  assertBoundedNonNegativeInteger(invalidRecordCount, 'browser runtime diagnostic evidence.invalidRecordCount');

  if (!Array.isArray(records) || records.length > defaultBrowserRuntimeDiagnosticRecordLimit) {
    throw new Error(`browser runtime diagnostic evidence.records must contain no more than ${defaultBrowserRuntimeDiagnosticRecordLimit} records`);
  }

  records.forEach(assertDiagnosticRecord);

  return {
    browserTest: { ...browserTest },
    discardedRecordCount,
    generatedAt,
    invalidRecordCount,
    records: records.map((record) => ({
      error: { ...record.error },
      network: {
        ...record.network,
        responseStatusCounts: { ...record.network.responseStatusCounts },
      },
      page: { ...record.page },
      scenarioCategory: record.scenarioCategory,
      timing: { ...record.timing },
    })),
    schemaVersion: browserRuntimeDiagnosticSchemaVersion,
  };
}

export function assertBrowserRuntimeDiagnosticRecord(record) {
  assertDiagnosticRecord(record);
  return record;
}

export function assertBrowserRuntimeDiagnosticEvidenceContract(evidence) {
  assertOnlyAllowedFields(evidence, new Set([
    'browserTest',
    'discardedRecordCount',
    'generatedAt',
    'invalidRecordCount',
    'records',
    'schemaVersion',
  ]), 'browser runtime diagnostic evidence');

  if (evidence.schemaVersion !== browserRuntimeDiagnosticSchemaVersion) {
    throw new Error(`browser runtime diagnostic evidence.schemaVersion must equal ${browserRuntimeDiagnosticSchemaVersion}`);
  }

  return createBrowserRuntimeDiagnosticEvidence(evidence);
}

export function parseBrowserRuntimeDiagnosticEvidence(text) {
  if (typeof text !== 'string' || text.length === 0) {
    throw new Error('browser runtime diagnostic evidence text is required');
  }

  try {
    return assertBrowserRuntimeDiagnosticEvidenceContract(JSON.parse(text));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('browser runtime diagnostic evidence must be valid JSON', { cause: error });
    }

    throw error;
  }
}

export async function writeBrowserRuntimeDiagnosticEvidence({
  cwd = process.cwd(),
  evidencePath,
  mkdirFn = mkdir,
  writeFileFn = writeFile,
  ...evidenceInput
} = {}) {
  const resolvedEvidencePath = resolveBrowserTestEvidencePath(evidencePath, { cwd });
  const evidence = createBrowserRuntimeDiagnosticEvidence(evidenceInput);

  await mkdirFn(dirname(resolvedEvidencePath), { recursive: true });
  await writeFileFn(resolvedEvidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');

  return {
    evidence,
    evidencePath: resolvedEvidencePath,
  };
}

export function renderBrowserRuntimeDiagnosticSummary(evidence) {
  const validatedEvidence = assertBrowserRuntimeDiagnosticEvidenceContract(evidence);
  const errorCounts = new Map();
  const scenarioCounts = new Map();

  for (const record of validatedEvidence.records) {
    errorCounts.set(record.error.category, (errorCounts.get(record.error.category) ?? 0) + 1);
    scenarioCounts.set(record.scenarioCategory, (scenarioCounts.get(record.scenarioCategory) ?? 0) + 1);
  }

  const renderCounts = (counts) => counts.size === 0
    ? 'none'
    : [...counts.entries()].map(([key, value]) => `${key}: ${value}`).join(', ');

  return [
    '### Browser runtime diagnostic',
    '',
    `- Test result: **${validatedEvidence.browserTest.status === 'passed' ? 'Passed' : 'Failed'}**`,
    `- Fixed Node workers: **${validatedEvidence.browserTest.workerCount}**`,
    `- Test runtime: **${(validatedEvidence.browserTest.durationMs / 1_000).toFixed(1)} seconds**`,
    `- Bounded failed-scenario records: **${validatedEvidence.records.length}**`,
    `- Error categories: ${renderCounts(errorCounts)}`,
    `- Scenario categories: ${renderCounts(scenarioCounts)}`,
    `- Discarded records: **${validatedEvidence.discardedRecordCount}**; invalid records: **${validatedEvidence.invalidRecordCount}**`,
    '',
  ].join('\n');
}

export async function writeBrowserRuntimeDiagnosticSummary({
  appendFileFn,
  cwd = process.cwd(),
  evidencePath,
  readFileFn = readFile,
  summaryPath,
} = {}) {
  if (!normalizeEvidencePath(summaryPath)) {
    throw new Error('browser runtime diagnostic summary path is required');
  }

  const resolvedEvidencePath = resolveBrowserTestEvidencePath(evidencePath, { cwd });
  const evidenceText = await readFileFn(resolvedEvidencePath, 'utf8');
  const summary = renderBrowserRuntimeDiagnosticSummary(parseBrowserRuntimeDiagnosticEvidence(evidenceText));
  const append = appendFileFn ?? ((filePath, content) => writeFile(filePath, content, { encoding: 'utf8', flag: 'a' }));

  await append(summaryPath, summary);
  return summary;
}
