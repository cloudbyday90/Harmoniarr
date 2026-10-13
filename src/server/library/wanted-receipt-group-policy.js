/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { isDeepStrictEqual } from 'node:util';
import { isSupportedOperatorTrackScope } from '../metadata/operator-track-scope-policy.js';

export const WANTED_RECEIPT_GROUP_LIMIT = 128;

function capture(value, budget, depth = 0) {
  if (++budget.nodes > 128 || depth > 6) throw null;
  if (typeof value === 'string') {
    budget.characters += value.length;
    if (value.length > 4096 || budget.characters > 16_384) throw null;
    return value;
  }
  if (value === null || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) return value;
  if (!value || typeof value !== 'object' || budget.seen.has(value)) throw null;
  budget.seen.add(value);
  if (Array.isArray(value)) {
    if (value.length > 16) throw null;
    return Object.freeze(arrayValues(value).map(item => capture(item, budget, depth + 1)));
  }
  if (Object.getPrototypeOf(value) !== Object.prototype) throw null;
  const keys = Reflect.ownKeys(value);
  if (keys.length > 32) throw null;
  const copy = {};
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== 'string' || key.length > 128 || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) throw null;
    budget.characters += key.length;
    if (budget.characters > 16_384) throw null;
    Object.defineProperty(copy, key, { value: capture(descriptor.value, budget, depth + 1), enumerable: true });
  }
  return Object.freeze(copy);
}

function arrayValues(value) {
  if (Object.getPrototypeOf(value) !== Array.prototype || Reflect.ownKeys(value).length !== value.length + 1) throw null;
  const result = [];
  for (let index = 0; index < value.length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) throw null;
    result.push(descriptor.value);
  }
  return result;
}

/** Captures candidates only; a plan never proves current availability. */
export function captureClosedWantedReceiptGroup(receipts, ownerId) {
  if (typeof ownerId !== 'string' || !ownerId || ownerId.length > 128
    || !Array.isArray(receipts) || receipts.length < 3 || receipts.length > WANTED_RECEIPT_GROUP_LIMIT) return null;
  try {
    const rows = arrayValues(receipts).map(row => capture(row, { nodes: 0, characters: 0, seen: new Set() }));
    const first = rows[0];
    if (!rows.every(row => row.version === 1 && row.ownerId === ownerId
      && typeof row.wantedReleaseId === 'string' && row.wantedReleaseId.length > 0
      && row.wantedReleaseId === first.wantedReleaseId && isSupportedOperatorTrackScope(row.scope)
      && row.scope.mode === 'tracks' && isDeepStrictEqual(row.scope, first.scope)
      && row.files?.length === 1 && typeof row.files[0].libraryPath === 'string' && row.files[0].libraryPath.length > 0
      && row.files[0].libraryPath === first.files[0].libraryPath
      && Number.isSafeInteger(row.files[0].evidence?.sizeBytes) && row.files[0].evidence.sizeBytes > 0
      && typeof row.files[0].evidence.sha256 === 'string' && /^[0-9a-f]{64}$/u.test(row.files[0].evidence.sha256)
      && Object.keys(row.files[0].evidence).length === 2
      && isDeepStrictEqual(row.files[0].evidence, first.files[0].evidence))) return null;
    return Object.freeze(rows);
  } catch { return null; } // Unsupported JSON/shape retains ordinary serial verification.
}
