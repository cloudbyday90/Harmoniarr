/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { readFileSync } from 'node:fs';
import pg from 'pg';
import pgPackage from 'pg/package.json' with { type: 'json' };

// Internal adapters are reviewed together against these installed implementations.
export function supportsPgObserverDriver() {
  try {
    const metadata = JSON.parse(readFileSync(new URL('../package.json', import.meta.resolve('pg-pool')), 'utf8'));
    return pgPackage.version === '8.23.0' && metadata.version === '3.14.0';
  } catch { return false; }
}

export function supportsPgQueueObserver(pool) {
  return supportsPgObserverDriver() && pool instanceof pg.Pool && pool.Client === pg.Client
    && ['connect', 'newClient', '_acquireClient', '_pulseQueue'].every(key => pool[key] === pg.Pool.prototype[key]);
}
