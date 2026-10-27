/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { lockSessionFamily } from './session-family-lock-store.js';
import { insertSessionToken } from './session-issuance-store.js';
import { toIssuedSession } from './session-issuance-policy.js';
import { toSessionUser } from './session-user-policy.js';

/** Borrow an existing transaction whose caller already holds account eligibility. */
export async function publishOwnedRootSession(client, { owner, material, metadata }, check) {
  await lockSessionFamily(client, material.tokenFamilyId); check();
  const id = await insertSessionToken(client, { userId: owner.id, material, metadata }); check();
  return toIssuedSession(material, id, toSessionUser(owner));
}
