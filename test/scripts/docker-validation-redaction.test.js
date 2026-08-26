/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createRedactedDockerValidationError,
  redactDockerValidationText,
} from '../../scripts/docker-validation-redaction.js';

test('Docker validation redaction masks secret values and temporary workspace paths', () => {
  const redacted = redactDockerValidationText(
    'request api-key-123 from C:/temporary/controlled-provider/secrets failed',
    {
      sensitivePaths: ['C:/temporary/controlled-provider'],
      sensitiveValues: ['api-key-123'],
    },
  );

  assert.equal(redacted, 'request [redacted] from [redacted]/secrets failed');
});

test('Docker validation failures redact both command output and appended service logs', () => {
  const error = createRedactedDockerValidationError({
    error: new Error('docker compose failed with api-key-123 at C:/temporary/controlled-provider'),
    logLabel: 'Controlled-provider Compose logs',
    logs: 'controlled-provider | rejected api-key-123 from C:/temporary/controlled-provider/downloads',
    sensitivePaths: ['C:/temporary/controlled-provider'],
    sensitiveValues: ['api-key-123'],
  });

  assert.match(error.message, /Controlled-provider Compose logs \(redacted\):/u);
  assert.doesNotMatch(error.message, /api-key-123|C:\/temporary\/controlled-provider/u);
  assert.match(error.message, /\[redacted\]/u);
  assert.equal(Object.hasOwn(error, 'cause'), false);
});
