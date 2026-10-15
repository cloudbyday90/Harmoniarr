/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { runLinuxCanonicalMedia } from '../testing/integration/linux-canonical-media-lane.js';

const controller = new AbortController();
const cancel = () => controller.abort(new Error('Linux canonical media validation cancelled'));
process.once('SIGINT', cancel); process.once('SIGTERM', cancel);
try {
  if (process.argv.length !== 2) throw new Error('This lane accepts no filters or file overrides');
  console.log(`[linux-canonical-media] ${JSON.stringify(await runLinuxCanonicalMedia({ signal: controller.signal }))}`);
} catch {
  console.error('[linux-canonical-media] fixture_linux_canonical_media_refused'); process.exitCode = 1;
} finally {
  process.removeListener('SIGINT', cancel); process.removeListener('SIGTERM', cancel);
}
