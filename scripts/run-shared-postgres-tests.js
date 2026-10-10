/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { runSharedPostgresTests } from '../testing/integration/postgres-test-launcher.js';

const controller = new AbortController();
const stop = () => controller.abort(new Error('Owned PostgreSQL test run cancelled'));
process.once('SIGINT', stop); process.once('SIGTERM', stop);
try {
  const result = await runSharedPostgresTests({ args: process.argv.slice(2), signal: controller.signal });
  console.log(`[shared-postgres] ${JSON.stringify({ version: 1, ...result })}`);
} catch (error) {
  const code = typeof error?.code === 'string' && /^fixture_[a-z_]{1,70}$/u.test(error.code)
    ? error.code : 'fixture_parent_run_failed';
  console.error(`[shared-postgres] ${code}`);
  process.exitCode = 1;
} finally {
  process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop);
}
