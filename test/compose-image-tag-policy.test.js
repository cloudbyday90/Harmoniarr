/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { findComposeImageTagViolations } from '../scripts/compose-image-tag-policy.js';

test('compose image tag policy accepts directly pinned image refs', () => {
  const source = `services:\n  harmoniarr:\n    image: ghcr.io/cloudbyday90/harmoniarr:0.1.0-beta\n`;

  assert.deepEqual(findComposeImageTagViolations('compose.yaml', source), []);
});

test('compose image tag policy accepts env override with pinned fallback', () => {
  const source = `services:\n  harmoniarr:\n    image: "\${HARMONIARR_IMAGE:-ghcr.io/cloudbyday90/harmoniarr:0.1.0-beta}"\n`;

  assert.deepEqual(findComposeImageTagViolations('compose.yaml', source), []);
});

test('compose image tag policy rejects unresolved image variables without fallback', () => {
  const source = `services:\n  harmoniarr:\n    image: "\${HARMONIARR_IMAGE}"\n`;

  const violations = findComposeImageTagViolations('compose.yaml', source);

  assert.equal(violations.length, 1);
  assert.match(violations[0].reason, /unresolved variable/);
});

test('compose image tag policy rejects fallback refs that still float on latest', () => {
  const source = `services:\n  harmoniarr:\n    image: "\${HARMONIARR_IMAGE:-ghcr.io/cloudbyday90/harmoniarr:latest}"\n`;

  const violations = findComposeImageTagViolations('compose.yaml', source);

  assert.equal(violations.length, 1);
  assert.match(violations[0].reason, /floating tag latest/);
});