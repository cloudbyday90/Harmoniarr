/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const earlyFailureMarker = '[harmoniarr-test-failure] ';

const allowedClasses = new Set([
  'AbortError', 'AggregateError', 'AssertionError', 'Error', 'RangeError',
  'ReferenceError', 'SyntaxError', 'TypeError', 'URIError',
]);
const allowedCodes = new Set([
  'ABORT_ERR', 'ECONNREFUSED', 'ECONNRESET', 'ERR_ASSERTION', 'ERR_TEST_FAILURE',
  'ERR_TEST_TIMEOUT', 'ETIMEDOUT', '23503', '23505', '40001', '40P01', '57P01',
  'operation_run_cancelled', 'operation_run_lease_lost', 'operation_run_paused',
]);
const allowedFailureCategories = new Map([
  ['cancelledByParent', 'cancelled'],
  ['hookFailed', 'hook'],
  ['testTimeoutFailure', 'timeout'],
  ['uncaughtException', 'uncaught'],
  ['unhandledRejection', 'unhandled'],
]);
const maximumFrames = 5;

function readProperty(value, key) {
  try {
    return value && (typeof value === 'object' || typeof value === 'function')
      ? value[key]
      : undefined;
  } catch {
    return undefined;
  }
}

function allowlisted(value, allowed) {
  return typeof value === 'string' && allowed.has(value) ? value : null;
}

function positivePosition(value) {
  return Number.isSafeInteger(value) && value > 0 && value <= 1_000_000 ? value : null;
}

function isProjectCodePath(relative) {
  return relative.length <= 240
    && /^(?:src|test|testing|scripts)\/[A-Za-z0-9_./-]+\.(?:js|mjs|vue)$/.test(relative);
}

function sourceLocation(file, line, column, projectRoot) {
  if (typeof file !== 'string' || file.length > 2048
    || positivePosition(line) === null || positivePosition(column) === null) {
    return null;
  }
  try {
    let sourcePath = file;
    if (file.startsWith('file:')) {
      const sourceUrl = new URL(file);
      if (sourceUrl.search || sourceUrl.hash) return null;
      sourcePath = fileURLToPath(sourceUrl);
    }
    if (!path.isAbsolute(sourcePath)) return null;
    const lexicalRelative = path.relative(path.resolve(projectRoot), sourcePath).split(path.sep).join('/');
    if (!isProjectCodePath(lexicalRelative)) return null;
    const rootPath = realpathSync(projectRoot);
    const realSourcePath = realpathSync(sourcePath);
    const relative = path.relative(rootPath, realSourcePath).split(path.sep).join('/');
    if (!isProjectCodePath(relative) || !statSync(realSourcePath).isFile()) {
      return null;
    }
    return { file: relative, line, column };
  } catch {
    return null;
  }
}

function sourceFrames(error, projectRoot) {
  const stack = readProperty(error, 'stack');
  if (typeof stack !== 'string') return [];
  const frames = [];
  const seen = new Set();
  for (const line of stack.slice(0, 16_384).split('\n').slice(0, 64)) {
    // Only inspect frame locations. Error prose and function names are not output.
    const match = /^\s+at (?:.+ \()?(.+):(\d+):(\d+)\)?$/.exec(line);
    if (!match) continue;
    const location = sourceLocation(match[1], Number(match[2]), Number(match[3]), projectRoot);
    if (!location) continue;
    const identity = `${location.file}:${location.line}:${location.column}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    frames.push(location);
    if (frames.length === maximumFrames) break;
  }
  return frames;
}

function failureCategory(wrapper, code, errorClass) {
  if (code === 'ERR_ASSERTION' || errorClass === 'AssertionError') return 'assertion';
  const failureType = readProperty(wrapper, 'failureType');
  if (typeof failureType === 'string' && allowedFailureCategories.has(failureType)) {
    return allowedFailureCategories.get(failureType);
  }
  if (code === 'ERR_TEST_TIMEOUT' || code === 'ETIMEDOUT') return 'timeout';
  if (code === 'ABORT_ERR' || code === 'operation_run_cancelled') return 'cancelled';
  if (code === 'ECONNREFUSED' || code === 'ECONNRESET') return 'connection';
  if (['23503', '23505', '40001', '40P01', '57P01'].includes(code)) return 'database';
  if (code === 'operation_run_lease_lost' || code === 'operation_run_paused') return 'ownership';
  return 'error';
}

export function createEarlyFailureRecord(event, { projectRoot = process.cwd() } = {}) {
  if (readProperty(event, 'type') !== 'test:fail') return null;
  const data = readProperty(event, 'data');
  const wrapper = readProperty(readProperty(data, 'details'), 'error');
  if (readProperty(wrapper, 'failureType') === 'subtestsFailed') return null;
  const error = readProperty(wrapper, 'cause') ?? wrapper;
  const code = allowlisted(readProperty(error, 'code'), allowedCodes)
    ?? allowlisted(readProperty(wrapper, 'code'), allowedCodes);
  const errorClass = allowlisted(readProperty(error, 'name'), allowedClasses);
  return {
    version: 1,
    category: failureCategory(wrapper, code, errorClass),
    code,
    errorClass,
    location: sourceLocation(
      readProperty(data, 'file'), readProperty(data, 'line'), readProperty(data, 'column'), projectRoot,
    ),
    frames: sourceFrames(error, projectRoot),
  };
}

export function formatEarlyFailure(event, options) {
  const record = createEarlyFailureRecord(event, options);
  return record === null ? null : `${earlyFailureMarker}${JSON.stringify(record)}\n`;
}
