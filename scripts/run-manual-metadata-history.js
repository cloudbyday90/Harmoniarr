/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */

import { runManualMetadataHistory } from '../testing/manual/manual-session-runner.js';
import { withManualHistorySession } from '../testing/manual/metadata-history-session.js';

if (process.argv.length > 2) throw new Error('This fixture accepts no host, port, database or provider arguments.');
await runManualMetadataHistory({ runSession: withManualHistorySession });
