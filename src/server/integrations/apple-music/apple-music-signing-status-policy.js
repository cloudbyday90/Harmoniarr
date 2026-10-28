/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { normalizeAppleMusicIdentifier, normalizeAppleMusicPrivateKey } from './apple-music-credential-validation.js';

function checkValue(value, normalize) {
  if (value == null) return 'missing';
  try { return normalize(value) ? 'valid' : 'missing'; }
  catch { return 'invalid'; }
}

/** Local representation/key suitability only; never signs or contacts Apple. */
export function buildAppleMusicSigningStatus({ teamId, keyId, privateKey }) {
  const checks = {
    teamId: checkValue(teamId, value => normalizeAppleMusicIdentifier(value, 'providers.appleMusicTeamId')),
    keyId: checkValue(keyId, value => normalizeAppleMusicIdentifier(value, 'providers.appleMusicKeyId')),
    privateKey: checkValue(privateKey, normalizeAppleMusicPrivateKey),
  };
  const values = Object.values(checks);
  return { state: values.includes('invalid') ? 'invalid' : values.includes('missing') ? 'incomplete' : 'valid', checks };
}
