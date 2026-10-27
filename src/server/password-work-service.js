/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { createApiError } from './api-error.js';
import { assertPasswordInput } from './password-input-policy.js';

const deriveScrypt = promisify(scrypt);
export const passwordWorkConcurrency = 2;
export const compatibleScryptParameters = Object.freeze({ N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 });

export function createPasswordWorkService({ deriveFn = deriveScrypt, maxConcurrent = passwordWorkConcurrency } = {}) {
  if (!Number.isSafeInteger(maxConcurrent) || maxConcurrent < 1 || maxConcurrent > passwordWorkConcurrency) throw new TypeError('A bounded password concurrency is required');
  let active = 0;
  async function derive(password, salt) {
    const key = await deriveFn(password, salt, 64, compatibleScryptParameters);
    if (!Buffer.isBuffer(key) || key.length !== 64) throw new Error('Invalid password derivation result');
    return key;
  }
  async function run(work) {
    if (active >= maxConcurrent) throw createApiError(503, 'password_work_busy', 'Password verification is temporarily busy. Try again.');
    active++;
    try { return await work(); }
    catch (cause) { throw Object.assign(createApiError(503, 'password_work_unavailable', 'Password verification is temporarily unavailable. Try again.'), { cause }); }
    finally { active--; }
  }
  return {
    getState: () => ({ active, maxConcurrent, pending: 0 }),
    async hashPassword(password) {
      assertPasswordInput(password);
      return run(async () => {
        const salt = randomBytes(16).toString('hex');
        const derived = await derive(password, salt);
        return `scrypt$${salt}$${derived.toString('hex')}`;
      });
    },
    async verifyPassword(password, storedHash) {
      assertPasswordInput(password);
      const match = typeof storedHash === 'string' && storedHash.length === 168
        ? /^scrypt\$([a-fA-F0-9]{32})\$([a-fA-F0-9]{128})$/u.exec(storedHash) : null;
      if (!match) return false;
      return run(async () => {
        const derived = await derive(password, match[1]);
        return timingSafeEqual(Buffer.from(match[2], 'hex'), derived);
      });
    },
  };
}

const sharedPasswordWork = createPasswordWorkService();
export const hashPassword = password => sharedPasswordWork.hashPassword(password);
export const verifyPassword = (password, storedHash) => sharedPasswordWork.verifyPassword(password, storedHash);
export const getPasswordWorkState = () => sharedPasswordWork.getState();
