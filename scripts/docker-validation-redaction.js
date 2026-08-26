/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const redactionMarker = '[redacted]';

function getMessage(error) {
  return error instanceof Error ? error.message : String(error ?? 'Unknown Docker validation failure');
}

function getRedactionValues(values) {
  return [...new Set(values.filter((value) => (
    typeof value === 'string' && value.length > 0
  )))].sort((left, right) => right.length - left.length);
}

export function redactDockerValidationText(value, {
  sensitivePaths = [],
  sensitiveValues = [],
} = {}) {
  return getRedactionValues([...sensitiveValues, ...sensitivePaths]).reduce(
    (text, secret) => text.replaceAll(secret, redactionMarker),
    String(value ?? ''),
  );
}

/**
 * Creates a bounded failure message for disposable Docker validation. It never
 * retains the original Error as a cause because its command output may contain
 * values that have deliberately been redacted from the returned message.
 */
export function createRedactedDockerValidationError({
  error,
  logs = null,
  logLabel = 'Docker Compose logs',
  sensitivePaths = [],
  sensitiveValues = [],
} = {}) {
  const options = { sensitivePaths, sensitiveValues };
  const message = redactDockerValidationText(getMessage(error), options);
  const redactedLogs = redactDockerValidationText(logs, options).trim();
  const logOutput = redactedLogs
    ? `\n${logLabel} (redacted):\n${redactedLogs}`
    : '';

  return new Error(`${message}${logOutput}`);
}
