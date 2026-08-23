/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { findComposeSingleNodeTopologyViolations } from '../scripts/compose-single-node-topology-policy.js';

function composeSource(deployBlock) {
  return `services:\n  harmoniarr:\n${deployBlock.split('\n').map((line) => `    ${line}`).join('\n')}\n    image: harmoniarr:test\n`;
}

test('compose single-node topology policy accepts an explicit one-replica service', () => {
  const source = composeSource('deploy:\n  mode: replicated\n  replicas: 1');

  assert.deepEqual(findComposeSingleNodeTopologyViolations('compose.yaml', source), []);
});

test('compose single-node topology policy rejects a missing deploy block', () => {
  const source = 'services:\n  harmoniarr:\n    image: harmoniarr:test\n';
  const violations = findComposeSingleNodeTopologyViolations('compose.yaml', source);

  assert.equal(violations.length, 1);
  assert.match(violations[0].reason, /explicitly declare/);
});

test('compose single-node topology policy rejects non-replicated deployment modes', () => {
  const source = composeSource('deploy:\n  mode: global\n  replicas: 1');
  const violations = findComposeSingleNodeTopologyViolations('compose.yaml', source);

  assert.equal(violations.length, 1);
  assert.match(violations[0].reason, /mode must be replicated/);
});

test('compose single-node topology policy rejects multiple replicas', () => {
  const source = composeSource('deploy:\n  mode: replicated\n  replicas: 2');
  const violations = findComposeSingleNodeTopologyViolations('compose.yaml', source);

  assert.equal(violations.length, 1);
  assert.match(violations[0].reason, /replicas must be 1/);
});
