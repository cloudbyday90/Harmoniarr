/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAppleMusicSigningChecks, buildAppleMusicSigningPresentation, hasAppleMusicCredentialDraft, normalizeAppleMusicSigningStatus } from '../../src/client/lib/apple-music-signing-presentation.js';

const valid = { state: 'valid', checks: { teamId: 'valid', keyId: 'valid', privateKey: 'valid' } };
test('Apple signing presentation copies only consistent approved checks', () => {
  const input = { ...valid, rawKey: 'PRIVATE-input-sentinel', checks: { ...valid.checks, value: 'PRIVATE-input-sentinel' } };
  const status = normalizeAppleMusicSigningStatus(input);
  assert.deepEqual(status, valid); input.checks.teamId = 'invalid'; assert.equal(status.checks.teamId, 'valid');
  assert.ok(!JSON.stringify(status).includes('PRIVATE-input-sentinel'));
  for (const value of [null, {}, { ...valid, state: 'incomplete' }, { ...valid, checks: [] }, { ...valid, checks: { ...valid.checks, teamId: 'PRIVATE-input-sentinel' } }]) assert.equal(normalizeAppleMusicSigningStatus(value), null);
});
test('Apple signing presentation distinguishes missing, invalid and local-only success', () => {
  for (const [state, check, tone] of [['valid', 'valid', 'success'], ['incomplete', 'missing', 'warning'], ['invalid', 'invalid', 'danger']]) {
    const status = normalizeAppleMusicSigningStatus({ state, checks: { ...valid.checks, privateKey: check } });
    assert.equal(buildAppleMusicSigningPresentation({ status }).tone, tone);
    assert.equal(buildAppleMusicSigningChecks(status)[2].name, 'Saved private key');
  }
  assert.match(buildAppleMusicSigningPresentation({ status: valid }).detail, /has not been contacted/u);
  assert.equal(buildAppleMusicSigningPresentation({ status: valid, loading: true }).tone, 'info');
  assert.match(buildAppleMusicSigningPresentation({ status: valid, loading: true, saving: true }).label, /Saving/u);
  assert.match(buildAppleMusicSigningPresentation({ status: valid, failed: true }).label, /unavailable/u);
});
test('Apple draft comparison distinguishes saved IDs, key/clear intent and unrelated edits', () => {
  const saved = { teamId: 'TESTTEAM01', keyId: 'TESTKEY001' }, providers = { appleMusicTeamId: saved.teamId, appleMusicKeyId: saved.keyId, appleMusicPrivateKey: '', clearAppleMusicPrivateKey: false };
  assert.equal(hasAppleMusicCredentialDraft(providers, null), false);
  assert.equal(hasAppleMusicCredentialDraft({ ...providers, appleMusicStorefront: 'gb', appleMusicEnabled: false }, saved), false);
  for (const patch of [{ appleMusicTeamId: 'NEWTEAM001' }, { appleMusicKeyId: 'NEWKEY0001' }, { appleMusicPrivateKey: 'PRIVATE-input-sentinel' }, { clearAppleMusicPrivateKey: true }]) assert.equal(hasAppleMusicCredentialDraft({ ...providers, ...patch }, saved), true);
  assert.equal(hasAppleMusicCredentialDraft({ ...providers, appleMusicPrivateKey: ' \n ' }, saved), false);
});
