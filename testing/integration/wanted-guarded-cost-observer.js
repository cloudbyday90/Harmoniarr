/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { performance } from 'node:perf_hooks';

const fields = Object.freeze(['rss', 'heapUsed', 'external', 'arrayBuffers']);
const windows = Object.freeze(['rootQuery', 'projection', 'fingerprint', 'digest']);
const rootStatement = `SELECT owner.id,owner.is_disabled,owner.managed_library_relative_root,
  root_setting.setting_key IS NOT NULL AS has_music_root_setting,root_setting.setting_value AS music_root
  FROM app_users owner LEFT JOIN app_settings root_setting
  ON root_setting.namespace='paths' AND root_setting.setting_key='music'
  WHERE owner.id=$1::uuid`.replace(/\s+/g, ' ').trim();

/** Benchmark-only fixed aggregates. Never retain query text, values, rows or domain inputs. */
export function createWantedGuardedCostObserver({ now = () => performance.now(),
  readMemory = () => process.memoryUsage() } = {}) {
  let timingUnavailable = false;
  const queries = Object.fromEntries(['rootContext', 'other'].map(key => [key, { count: 0, failures: 0, elapsedMs: 0 }]));
  const memoryWindows = Object.fromEntries(windows.map(key => [key, { count: 0, unavailable: 0,
    changes: Object.fromEntries(fields.map(field => [field, { min: null, max: null }])) }]));
  function read() {
    try {
      const value = readMemory();
      if (fields.some(field => !Number.isSafeInteger(value[field]) || value[field] < 0)) return null;
      return Object.fromEntries(fields.map(field => [field, value[field]]));
    } catch { return null; }
  }
  function clock() {
    try { const value = now(); if (Number.isFinite(value)) return value; } catch { /* Measurement only. */ }
    timingUnavailable = true; return null;
  }
  function openWindow(name) {
    const bucket = memoryWindows[name];
    if (!Object.hasOwn(memoryWindows, name)) throw new TypeError('Invalid guarded memory window');
    const before = read(); let closed = false;
    return () => {
      if (closed) return;
      closed = true; bucket.count++; const after = read();
      if (!before || !after) { bucket.unavailable++; return; }
      for (const field of fields) {
        const change = after[field] - before[field]; const range = bucket.changes[field];
        range.min = range.min === null ? change : Math.min(range.min, change);
        range.max = range.max === null ? change : Math.max(range.max, change);
      }
    };
  }
  return {
    openWindow,
    async query(text, work) {
      const isRoot = typeof text === 'string' && text.replace(/\s+/g, ' ').trim() === rootStatement;
      const bucket = queries[isRoot ? 'rootContext' : 'other'];
      const close = isRoot ? openWindow('rootQuery') : () => {};
      bucket.count++; const started = clock();
      try { return await work(); }
      catch (error) { bucket.failures++; throw error; }
      finally {
        const ended = clock();
        if (started !== null && ended !== null && ended >= started) bucket.elapsedMs += ended - started;
        else timingUnavailable = true;
        close();
      }
    },
    snapshot() { return structuredClone({ queries, memoryWindows, timingUnavailable }); },
  };
}
