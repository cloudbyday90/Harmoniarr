/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
const states = new WeakMap();
export const defaultPoolConnectionTimeoutMs = 5_000;
export function buildPoolAdmissionPolicy(env = process.env) {
  const value = env.HARMONIARR_PG_POOL_MAX_PENDING ?? '64';
  const maxPendingCheckouts = Number(value);
  if (!/^\d+$/u.test(String(value)) || !Number.isSafeInteger(maxPendingCheckouts) || maxPendingCheckouts < 1) throw new TypeError('HARMONIARR_PG_POOL_MAX_PENDING must be a positive integer');
  return { maxPendingCheckouts };
}
export function getPoolAdmissionState(pool) {
  const state = states.get(pool);
  return state ? { pendingCheckouts: state.pendingCheckouts, maxPendingCheckouts: state.maxPendingCheckouts } : null;
}

/** Bound unresolved public checkouts, including calls made by native pool.query. */
export function attachPoolAdmissionLimit(pool, { maxPendingCheckouts = 64 } = {}) {
  if (!Number.isSafeInteger(maxPendingCheckouts) || maxPendingCheckouts < 1) throw new TypeError('A positive pending checkout limit is required');
  if (states.has(pool)) throw new TypeError('Pool admission is already owned');
  const nativeConnect = pool.connect;
  const state = { pendingCheckouts: 0, maxPendingCheckouts }; states.set(pool, state);
  pool.connect = function connect(callback) {
    if (pool.ending) return nativeConnect.call(pool, callback);
    if (state.pendingCheckouts >= maxPendingCheckouts) {
      const error = Object.assign(new Error('Database checkout capacity is temporarily unavailable'), { code: 'database_pool_busy' });
      if (typeof callback === 'function') { process.nextTick(() => callback(error)); return; }
      return Promise.reject(error);
    }
    state.pendingCheckouts++;
    let settled = false;
    const finish = () => { if (!settled) { settled = true; state.pendingCheckouts--; } };
    try {
      if (typeof callback === 'function') return nativeConnect.call(pool, function (...args) { finish(); return callback.apply(this, args); });
      return nativeConnect.call(pool).then(value => { finish(); return value; }, error => { finish(); throw error; });
    } catch (error) { finish(); throw error; }
  };
  return pool;
}
