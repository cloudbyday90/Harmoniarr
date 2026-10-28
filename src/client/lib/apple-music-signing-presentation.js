/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
const checkStates = new Set(['valid', 'invalid', 'missing']);

/** Copy only approved enums; never retain response values/messages or other providers. */
export function normalizeAppleMusicSigningStatus(value) {
  if (!value || !value.checks || Array.isArray(value.checks)) return null;
  const { teamId, keyId, privateKey } = value.checks;
  const values = [teamId, keyId, privateKey];
  if (!values.every(check => checkStates.has(check))) return null;
  const state = values.includes('invalid') ? 'invalid' : values.includes('missing') ? 'incomplete' : 'valid';
  return value.state === state ? { state, checks: { teamId, keyId, privateKey } } : null;
}

export function hasAppleMusicCredentialDraft(providers, savedIds) {
  if (!savedIds) return false;
  return providers.appleMusicTeamId !== savedIds.teamId || providers.appleMusicKeyId !== savedIds.keyId
    || Boolean(providers.appleMusicPrivateKey?.trim()) || providers.clearAppleMusicPrivateKey === true;
}

export function buildAppleMusicSigningPresentation({ status, loading, saving, failed }) {
  if (saving) return { label: 'Saving Apple credentials…', tone: 'info', detail: 'Saved local status will refresh after this save finishes.' };
  if (loading) return { label: 'Checking saved Apple credentials…', tone: 'info', detail: 'This checks local signing requirements only.' };
  if (failed) return { label: 'Saved status unavailable.', tone: 'warning', detail: 'The saved credentials could not be checked. Try refreshing saved status.' };
  if (status?.state === 'valid') return { label: 'Saved credentials pass local checks.', tone: 'success', detail: 'Local checks only. Apple Music has not been contacted.' };
  if (status?.state === 'invalid') return { label: 'Saved credentials need review.', tone: 'danger', detail: 'Review saved values marked invalid below. Save replacements before refreshing.' };
  if (status?.state === 'incomplete') return { label: 'Saved credentials are incomplete.', tone: 'warning', detail: 'Add the missing saved values before checking provider access.' };
  return { label: 'Saved credentials have not been checked.', tone: 'info', detail: 'Refresh saved status to check local signing requirements.' };
}

export function buildAppleMusicSigningChecks(status) {
  if (!status) return [];
  const labels = { valid: 'Valid format', missing: 'Missing saved value', invalid: 'Invalid saved value' };
  return [['teamId', 'Saved Team ID'], ['keyId', 'Saved key ID'], ['privateKey', 'Saved private key']].map(([field, name]) => ({
    name, label: field === 'privateKey' && status.checks[field] === 'valid' ? 'P-256 key' : labels[status.checks[field]],
  }));
}
