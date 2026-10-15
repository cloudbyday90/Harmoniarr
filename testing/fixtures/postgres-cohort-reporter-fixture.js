/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { suite, test } from 'node:test';
suite('private-suite-canary', () => {
  test('private-case-canary', () => {});
  test('second-case', { skip: process.env.COHORT_CONTROL_SKIP === '1' }, () => {});
});
process.stderr.write('[fixture-phase] ' + JSON.stringify({ phase: 'scenario_work', outcome: 'passed', durationMs: 3 }) + '\n');
