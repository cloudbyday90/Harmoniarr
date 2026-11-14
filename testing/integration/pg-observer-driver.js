/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { readFileSync } from 'node:fs';
import pg from 'pg';
import pgPackage from 'pg/package.json' with { type: 'json' };
import { supportsPgObserverVersions } from './pg-observer-driver-policy.js';
import { hasPoolAdmissionConnect } from '../../src/server/database-pool-admission-service.js';

// Internal adapters are reviewed together against these installed implementations.
export function supportsPgObserverDriver() {
  try {
    const metadata = JSON.parse(readFileSync(new URL('../package.json', import.meta.resolve('pg-pool')), 'utf8'));
    const protocol = JSON.parse(readFileSync(new URL('../package.json', import.meta.resolve('pg-protocol')), 'utf8'));
    return supportsPgObserverVersions(pgPackage.version, metadata.version, protocol.version);
  } catch { return false; }
}

export function supportsPgQueueObserver(pool) {
  return supportsPgObserverDriver() && pool instanceof pg.Pool && pool.Client === pg.Client
    && (pool.connect === pg.Pool.prototype.connect || hasPoolAdmissionConnect(pool, pg.Pool.prototype.connect))
    && ['newClient', '_acquireClient', '_pulseQueue'].every(key => pool[key] === pg.Pool.prototype[key]);
}
