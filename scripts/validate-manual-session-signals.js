/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */

import { runManualSignalLane } from '../testing/manual/manual-signal-lane.js';

if (process.argv.length !== 2) throw new Error('The signal lane accepts no filters or target overrides.');
const controller = new AbortController();
const stop = () => controller.abort(new Error('Manual signal qualification stopped.'));
process.on('SIGINT', stop); process.on('SIGTERM', stop);
try {
  console.log(`[manual-signals] ${JSON.stringify(await runManualSignalLane({ signal: controller.signal }))}`);
} finally {
  process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop);
}
