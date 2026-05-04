import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPlexLibraryAccessPolicy } from '../../src/server/plex-library-access-policy.js';

test('buildPlexLibraryAccessPolicy treats Plex owner access as eligible', () => {
  assert.deepEqual(buildPlexLibraryAccessPolicy({
    homeRole: 'home_admin',
    libraryAccessDetails: {},
    libraryAccessState: 'owner',
  }), {
    classification: 'eligible',
    fulfillmentVisibilityEligible: true,
    libraryAccessConfirmed: true,
    needsOperatorReview: false,
    reasonCode: 'plex_owner_access',
    requestTargetingEligible: true,
    restrictionSignals: false,
    serverCount: 0,
  });
});

test('buildPlexLibraryAccessPolicy treats explicit shared access as eligible', () => {
  assert.deepEqual(buildPlexLibraryAccessPolicy({
    homeRole: 'home_member',
    libraryAccessDetails: { allowSync: true, serverIds: ['server-1', 'server-2'] },
    libraryAccessState: 'shared',
  }), {
    classification: 'eligible',
    fulfillmentVisibilityEligible: true,
    libraryAccessConfirmed: true,
    needsOperatorReview: false,
    reasonCode: 'plex_shared_library_access',
    requestTargetingEligible: true,
    restrictionSignals: true,
    serverCount: 2,
  });
});

test('buildPlexLibraryAccessPolicy requires review when managed membership has no confirmed library share', () => {
  assert.deepEqual(buildPlexLibraryAccessPolicy({
    homeRole: 'home_managed',
    libraryAccessDetails: { source: 'plex_home_directory' },
    libraryAccessState: 'unknown',
  }), {
    classification: 'review_required',
    fulfillmentVisibilityEligible: false,
    libraryAccessConfirmed: false,
    needsOperatorReview: true,
    reasonCode: 'plex_managed_access_unconfirmed',
    requestTargetingEligible: false,
    restrictionSignals: false,
    serverCount: 0,
  });
});