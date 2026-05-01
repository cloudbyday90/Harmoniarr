/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { isDirectExecution } from './script-entrypoint.js';

export function formatScriptErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function validateOutputStyle(style, propertyName) {
  if (style !== 'prefixed' && style !== 'raw') {
    throw new Error(`${propertyName} must be either "prefixed" or "raw"`);
  }
}

function ensureTrailingNewline(message) {
  return message.endsWith('\n') ? message : `${message}\n`;
}

function formatScriptMessage({ message, prefix, style }) {
  const normalizedMessage = ensureTrailingNewline(message);
  return style === 'raw' ? normalizedMessage : `[${prefix}] ${normalizedMessage}`;
}

export function createScriptReporter({
  prefix,
  stderr = process.stderr,
  stderrStyle = 'prefixed',
  stdout = process.stdout,
  stdoutStyle = 'prefixed',
} = {}) {
  if (!prefix) {
    throw new Error('prefix is required');
  }

  validateOutputStyle(stderrStyle, 'stderrStyle');
  validateOutputStyle(stdoutStyle, 'stdoutStyle');

  function writeInfo(message) {
    stdout.write(formatScriptMessage({ message, prefix, style: stdoutStyle }));
  }

  function writeError(error) {
    stderr.write(formatScriptMessage({
      message: formatScriptErrorMessage(error),
      prefix,
      style: stderrStyle,
    }));
  }

  return {
    writeError,
    writeInfo,
  };
}

export async function runScriptTask({
  prefix,
  processEmitter = process,
  renderSuccessMessage,
  run,
  stderr = process.stderr,
  stderrStyle = 'prefixed',
  stdout = process.stdout,
  stdoutStyle = 'prefixed',
} = {}) {
  if (!prefix) {
    throw new Error('prefix is required');
  }

  if (typeof run !== 'function') {
    throw new Error('run is required');
  }

  if (renderSuccessMessage != null && typeof renderSuccessMessage !== 'function') {
    throw new Error('renderSuccessMessage must be a function when provided');
  }

  const reporter = createScriptReporter({
    prefix,
    stderr,
    stderrStyle,
    stdout,
    stdoutStyle,
  });

  try {
    const result = await run();
    const successMessage = renderSuccessMessage ? renderSuccessMessage(result) : null;
    if (successMessage) {
      reporter.writeInfo(successMessage);
    }
  } catch (error) {
    reporter.writeError(error);
    processEmitter.exitCode = 1;
  }
}

export async function runDirectScriptTask(importMeta, options) {
  if (!importMeta || typeof importMeta !== 'object') {
    throw new Error('importMeta is required');
  }

  if (!isDirectExecution(importMeta)) {
    return false;
  }

  await runScriptTask(options);
  return true;
}