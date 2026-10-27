/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
const profile = (id, p) => Object.freeze({ id,
  parameters: Object.freeze({ N: 16384, r: 8, p, maxmem: 32 * 1024 * 1024 }) });

export const legacyPasswordHashProfile = profile('scrypt-legacy', 1);
export const currentPasswordHashProfile = profile('scrypt-v2', 5);
const currentPrefix = 'scrypt$v2$n=16384,r=8,p=5$';

// Stored text selects an allowlisted profile, never arbitrary native KDF options.
export function parsePasswordHash(value) {
  if (typeof value !== 'string') return null;
  let selected, match;
  if (value.length === 168) {
    selected = legacyPasswordHashProfile;
    match = /^scrypt\$([a-fA-F0-9]{32})\$([a-fA-F0-9]{128})$/u.exec(value);
  } else if (value.length === currentPrefix.length + 161) {
    selected = currentPasswordHashProfile;
    match = /^scrypt\$v2\$n=16384,r=8,p=5\$([a-fA-F0-9]{32})\$([a-fA-F0-9]{128})$/u.exec(value);
  }
  return match ? { profile: selected, salt: match[1], digest: match[2] } : null;
}

export const needsPasswordHashUpgrade = value => parsePasswordHash(value)?.profile === legacyPasswordHashProfile;
export const isCurrentPasswordHash = value => parsePasswordHash(value)?.profile === currentPasswordHashProfile;

export function formatCurrentPasswordHash(salt, digest) {
  if (typeof salt !== 'string' || !/^[a-f0-9]{32}$/u.test(salt)
    || !Buffer.isBuffer(digest) || digest.length !== 64) throw new TypeError('Invalid password hash material');
  return `${currentPrefix}${salt}$${digest.toString('hex')}`;
}
