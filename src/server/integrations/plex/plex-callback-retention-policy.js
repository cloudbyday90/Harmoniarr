/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { createHash } from 'node:crypto';
import { plexCallbackPrefix } from './plex-callback-policy.js';

export const plexCallbackRetentionBatchSize = 100;
export const plexCallbackRetentionIntervalMs = 5 * 60 * 1000;
export const plexCallbackLegacyRetentionMs = 24 * 60 * 60 * 1000;
export const plexCallbackRetentionLockKey = createHash('sha256').update('harmoniarr:plex-callback-retention:v1').digest().readBigInt64BE().toString();
export const plexCallbackRetentionNamePattern = '^' + plexCallbackPrefix.replaceAll('.', '[.]') + '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$';

/** Unknown/unreadable envelopes are not evidence of expiration. */
export function classifyPlexCallbackRetention({ plaintext, createdAt, updatedAt, observedAt }) {
  const observed = new Date(observedAt).getTime();
  if (observedAt == null || !Number.isFinite(observed)) throw new Error('Database observation time is required');
  if (typeof plaintext !== 'string') return { reason: 'unreadable' };
  let value;
  try { value = JSON.parse(plaintext); } catch { /* Apply the conservative malformed-record age below. */ }
  if (value && typeof value === 'object' && Object.hasOwn(value, 'version')) {
    if (value.version !== 1) return { reason: 'unknown' };
    const expires = typeof value.expiresAt === 'string' ? Date.parse(value.expiresAt) : NaN;
    if (Number.isFinite(expires) && new Date(expires).toISOString() === value.expiresAt) {
      return expires <= observed ? { reason: 'expired', deleteAfter: value.expiresAt } : { reason: 'active' };
    }
  }
  const created = createdAt == null ? NaN : new Date(createdAt).getTime();
  const updated = updatedAt == null ? NaN : new Date(updatedAt).getTime();
  if (!Number.isFinite(created) || !Number.isFinite(updated)) return { reason: 'unreadable' };
  const cutoff = Math.max(created, updated) + plexCallbackLegacyRetentionMs;
  return cutoff <= observed ? { reason: 'legacy', deleteAfter: new Date(cutoff).toISOString() } : { reason: 'recent' };
}
