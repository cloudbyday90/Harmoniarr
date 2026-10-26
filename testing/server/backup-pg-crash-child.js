/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { runBackupSqlCrashChild } from './backup-sql-crash-worker.js';
import { requireBackupPgCrashProfile } from './backup-pg-crash-profile.js';
await runBackupSqlCrashChild({requireProfile:requireBackupPgCrashProfile});
