/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { proveLinuxMediaSocket } from './media-linux-socket-scenario.js';

try { console.log(JSON.stringify(await proveLinuxMediaSocket({ inputPath: '/proof/input.json' }))); }
catch { console.error('Linux socket proof failed'); process.exitCode = 1; }
