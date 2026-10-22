/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { inspect } from 'node:util';
import { albumId, cover, createFanartWiringFixture } from './fanart-wiring-fixture.js';

const fixture = createFanartWiringFixture({ env: { FANARTTV_API_KEY: 'fixture-env-project', FANARTTV_CLIENT_KEY: 'fixture-env-personal' } });
await fixture.mutateKeys({ fanartTvApiKey: 'fixture-saved-project', fanartTvClientKey: 'fixture-saved-personal' });
assert.equal((await fixture.resolveAlbum()).assetId, 'fixture-asset');
await fixture.mutateKeys({ fanartTvApiKey: 'fixture-rotated-project', fanartTvClientKey: 'fixture-rotated-personal' });
assert.equal((await fixture.resolveAlbum()).assetId, 'fixture-asset');
await fixture.mutateKeys({ clearFanartTvApiKey: true, clearFanartTvClientKey: true });
assert.equal((await fixture.resolveAlbum()).assetId, 'fixture-asset');
await assert.rejects(fixture.resolveAlbum(), { code: 'fanarttv_invalid_response' });
fixture.failCredentials();
await assert.rejects(fixture.resolveAlbum(), error => error.diagnosticCode === 'credentials_unavailable' && !inspect(error).includes('fixture-private'));
assert.deepEqual(fixture.downloads, [cover.url, cover.url, cover.url]);
assert.equal(fixture.ingestions.length, 3);
assert.equal(fixture.assignments.length, 3);
assert.ok(fixture.assignments.every(assignment => assignment.ownerId === albumId && assignment.sourceReference === albumId));
console.log(JSON.stringify({ composedCredentials: true, rotationAndClear: true, targetOwnedAssignments: 3, mismatchAndCredentialFailureRefused: true,
  node: process.versions.node, tlsVerificationDisabled: process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0' }));
