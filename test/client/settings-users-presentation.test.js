/*
  Harmoniarr - Soulseek-native music library management
  Copyright (C) 2026 Harmoniarr Contributors

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with this program. If not, see <https://www.gnu.org/licenses/>.
*/

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildUsersEmptyStateBody,
  describePlexLibraryAccessPolicy,
  describePlexLocalAuthStatus,
  formatAuthProvider,
  formatPlexConflictReason,
  formatPlexHomeRole,
  formatPlexLibraryAccessState,
  formatPlexLinkStatusDetail,
  formatPlexProfileClassification,
  formatPlexProfileClassificationClass,
  formatUserRole,
  hasPendingManagedLibraryRootChanges,
  plexLibraryAccessPolicyLabel,
  plexLibraryAccessPolicyTone,
} from '../../src/client/lib/settings-users-presentation.js';

describe('formatUserRole', () => {
  it('returns Admin for admin', () => {
    assert.equal(formatUserRole('admin'), 'Admin');
  });
  it('returns Operator for operator', () => {
    assert.equal(formatUserRole('operator'), 'Operator');
  });
  it('returns Requester for requester', () => {
    assert.equal(formatUserRole('requester'), 'Requester');
  });
  it('capitalises unknown roles', () => {
    assert.equal(formatUserRole('superuser'), 'Superuser');
  });
  it('returns Unknown for null', () => {
    assert.equal(formatUserRole(null), 'Unknown');
  });
  it('returns Unknown for undefined', () => {
    assert.equal(formatUserRole(undefined), 'Unknown');
  });
  it('returns Unknown for empty string', () => {
    assert.equal(formatUserRole(''), 'Unknown');
  });
});

describe('formatAuthProvider', () => {
  it('returns password for local', () => {
    assert.equal(formatAuthProvider('local'), 'password');
  });
  it('returns Plex for plex', () => {
    assert.equal(formatAuthProvider('plex'), 'Plex');
  });
  it('returns password for null', () => {
    assert.equal(formatAuthProvider(null), 'password');
  });
  it('returns password for undefined', () => {
    assert.equal(formatAuthProvider(undefined), 'password');
  });
  it('returns password for unknown providers', () => {
    assert.equal(formatAuthProvider('saml'), 'password');
  });
  it('does not expose internal term "local" in any return value', () => {
    assert.ok(!formatAuthProvider('local').toLowerCase().includes('local'));
  });
});

describe('buildUsersEmptyStateBody', () => {
  it('returns a non-empty string', () => {
    const result = buildUsersEmptyStateBody();
    assert.ok(typeof result === 'string' && result.length > 0);
  });
  it('does not contain developer process jargon', () => {
    const result = buildUsersEmptyStateBody().toLowerCase();
    assert.ok(!result.includes('attach'), 'should not say "attach"');
    assert.ok(!result.includes('onboarding flow'), 'should not say "onboarding flow"');
    assert.ok(!result.includes('provisioning flow'), 'should not say "provisioning flow"');
  });
  it('mentions Plex linking as a capability', () => {
    assert.ok(buildUsersEmptyStateBody().toLowerCase().includes('plex'));
  });
});

describe('formatPlexLinkStatusDetail', () => {
  it('returns null when not linked', () => {
    assert.equal(formatPlexLinkStatusDetail({ linked: false }), null);
  });
  it('returns null for null input', () => {
    assert.equal(formatPlexLinkStatusDetail(null), null);
  });
  it('returns null for undefined input', () => {
    assert.equal(formatPlexLinkStatusDetail(undefined), null);
  });
  it('returns title and email when both present', () => {
    const result = formatPlexLinkStatusDetail({ linked: true, linkedUserTitle: 'Alice', linkedUserEmail: 'alice@example.com' });
    assert.equal(result, 'Linked as Alice (alice@example.com)');
  });
  it('returns title only when email absent', () => {
    const result = formatPlexLinkStatusDetail({ linked: true, linkedUserTitle: 'Alice', linkedUserEmail: null });
    assert.equal(result, 'Linked as Alice');
  });
  it('returns Linked when neither title nor email present', () => {
    const result = formatPlexLinkStatusDetail({ linked: true, linkedUserTitle: null, linkedUserEmail: null });
    assert.equal(result, 'Linked');
  });
});

describe('plexLibraryAccessPolicyLabel', () => {
  it('returns Eligible for eligible', () => {
    assert.equal(plexLibraryAccessPolicyLabel({ classification: 'eligible' }), 'Eligible');
  });
  it('returns Needs review for review_required', () => {
    assert.equal(plexLibraryAccessPolicyLabel({ classification: 'review_required' }), 'Needs review');
  });
  it('returns Unknown for null policy', () => {
    assert.equal(plexLibraryAccessPolicyLabel(null), 'Unknown');
  });
  it('returns Unknown for unknown classification', () => {
    assert.equal(plexLibraryAccessPolicyLabel({ classification: 'denied' }), 'Unknown');
  });
});

describe('plexLibraryAccessPolicyTone', () => {
  it('returns success for eligible', () => {
    assert.equal(plexLibraryAccessPolicyTone({ classification: 'eligible' }), 'success');
  });
  it('returns warning for review_required', () => {
    assert.equal(plexLibraryAccessPolicyTone({ classification: 'review_required' }), 'warning');
  });
  it('returns danger for null policy', () => {
    assert.equal(plexLibraryAccessPolicyTone(null), 'danger');
  });
  it('returns danger for unknown classification', () => {
    assert.equal(plexLibraryAccessPolicyTone({ classification: 'unknown' }), 'danger');
  });
});

describe('describePlexLibraryAccessPolicy', () => {
  it('describes plex owner access', () => {
    const result = describePlexLibraryAccessPolicy({ reasonCode: 'plex_owner_access' });
    assert.ok(result.toLowerCase().includes('owner'));
    assert.ok(result.toLowerCase().includes('confirmed'));
  });
  it('describes shared library access with server count', () => {
    const result = describePlexLibraryAccessPolicy({ reasonCode: 'plex_shared_library_access', serverCount: 2 });
    assert.ok(result.includes('2 servers'));
  });
  it('uses singular server for count of 1', () => {
    const result = describePlexLibraryAccessPolicy({ reasonCode: 'plex_shared_library_access', serverCount: 1 });
    assert.ok(result.includes('1 server'));
    assert.ok(!result.includes('1 servers'));
  });
  it('omits server count when serverCount is 0', () => {
    const result = describePlexLibraryAccessPolicy({ reasonCode: 'plex_shared_library_access', serverCount: 0 });
    assert.ok(!result.includes('servers'));
  });
  it('describes managed access unconfirmed', () => {
    const result = describePlexLibraryAccessPolicy({ reasonCode: 'plex_managed_access_unconfirmed' });
    assert.ok(result.toLowerCase().includes('managed'));
    assert.ok(result.toLowerCase().includes('review'));
  });
  it('describes member access unconfirmed', () => {
    const result = describePlexLibraryAccessPolicy({ reasonCode: 'plex_member_access_unconfirmed' });
    assert.ok(result.toLowerCase().includes('review'));
  });
  it('returns fallback for unknown reasonCode', () => {
    const result = describePlexLibraryAccessPolicy({ reasonCode: 'unknown' });
    assert.ok(result.toLowerCase().includes('review'));
  });
  it('returns fallback for null policy', () => {
    const result = describePlexLibraryAccessPolicy(null);
    assert.ok(result.toLowerCase().includes('review'));
  });
});

describe('describePlexLocalAuthStatus', () => {
  it('returns blocked message when unlinkPlexReady is false', () => {
    const result = describePlexLocalAuthStatus({ localAuth: { unlinkPlexReady: false } });
    assert.ok(result.toLowerCase().includes('blocked'));
  });
  it('returns blocked message for null user', () => {
    const result = describePlexLocalAuthStatus(null);
    assert.ok(result.toLowerCase().includes('blocked'));
  });
  it('returns ready message when unlinkPlexReady is true', () => {
    const result = describePlexLocalAuthStatus({ localAuth: { unlinkPlexReady: true } });
    assert.ok(result.toLowerCase().includes('ready'));
  });
  it('includes "since" timestamp when passwordChangedAt is provided', () => {
    const result = describePlexLocalAuthStatus({
      localAuth: { unlinkPlexReady: true, passwordChangedAt: '2026-01-01T00:00:00Z' },
    });
    assert.ok(result.includes('since'));
  });
  it('omits timestamp when passwordChangedAt is null', () => {
    const result = describePlexLocalAuthStatus({
      localAuth: { unlinkPlexReady: true, passwordChangedAt: null },
    });
    assert.ok(!result.includes('since'));
  });
  it('includes must-change notice when mustChangePassword is true', () => {
    const result = describePlexLocalAuthStatus({
      localAuth: { unlinkPlexReady: true, mustChangePassword: true },
    });
    assert.ok(result.toLowerCase().includes('change'));
  });
  it('omits must-change notice when mustChangePassword is false', () => {
    const result = describePlexLocalAuthStatus({
      localAuth: { unlinkPlexReady: true, mustChangePassword: false },
    });
    assert.ok(!result.toLowerCase().includes('prompted to change'));
  });
});

describe('hasPendingManagedLibraryRootChanges', () => {
  it('returns false when both are equal', () => {
    assert.equal(hasPendingManagedLibraryRootChanges({
      pendingManagedLibraryRelativeRoot: 'family/alice',
      managedLibraryRelativeRoot: 'family/alice',
    }), false);
  });
  it('returns true when pending differs from saved', () => {
    assert.equal(hasPendingManagedLibraryRootChanges({
      pendingManagedLibraryRelativeRoot: 'family/bob',
      managedLibraryRelativeRoot: 'family/alice',
    }), true);
  });
  it('returns false when both are empty string', () => {
    assert.equal(hasPendingManagedLibraryRootChanges({
      pendingManagedLibraryRelativeRoot: '',
      managedLibraryRelativeRoot: '',
    }), false);
  });
  it('treats null and empty string as equivalent', () => {
    assert.equal(hasPendingManagedLibraryRootChanges({
      pendingManagedLibraryRelativeRoot: null,
      managedLibraryRelativeRoot: '',
    }), false);
  });
  it('returns true when pending is set but saved is empty', () => {
    assert.equal(hasPendingManagedLibraryRootChanges({
      pendingManagedLibraryRelativeRoot: 'family/alice',
      managedLibraryRelativeRoot: null,
    }), true);
  });
  it('returns false for null user', () => {
    assert.equal(hasPendingManagedLibraryRootChanges(null), false);
  });
});

describe('formatPlexProfileClassification', () => {
  it('returns Ready to import for create', () => {
    assert.equal(formatPlexProfileClassification('create'), 'Ready to import');
  });
  it('returns Already linked for linked', () => {
    assert.equal(formatPlexProfileClassification('linked'), 'Already linked');
  });
  it('returns Needs review for conflict', () => {
    assert.equal(formatPlexProfileClassification('conflict'), 'Needs review');
  });
  it('returns Owner (skipped) for owner', () => {
    assert.equal(formatPlexProfileClassification('owner'), 'Owner (skipped)');
  });
  it('returns Unknown for null', () => {
    assert.equal(formatPlexProfileClassification(null), 'Unknown');
  });
  it('returns the raw value for unknown classifications', () => {
    assert.equal(formatPlexProfileClassification('pending'), 'pending');
  });
  it('does not expose raw enum values for known classifications', () => {
    assert.notEqual(formatPlexProfileClassification('create'), 'create');
    assert.notEqual(formatPlexProfileClassification('linked'), 'linked');
    assert.notEqual(formatPlexProfileClassification('conflict'), 'conflict');
  });
});

describe('formatPlexProfileClassificationClass', () => {
  it('returns review-status-selected for create', () => {
    assert.equal(formatPlexProfileClassificationClass('create'), 'review-status-selected');
  });
  it('returns review-status-held for linked', () => {
    assert.equal(formatPlexProfileClassificationClass('linked'), 'review-status-held');
  });
  it('returns review-status-failed for conflict', () => {
    assert.equal(formatPlexProfileClassificationClass('conflict'), 'review-status-failed');
  });
  it('returns review-status-failed for unknown value', () => {
    assert.equal(formatPlexProfileClassificationClass('unknown'), 'review-status-failed');
  });
});

describe('formatPlexHomeRole', () => {
  it('returns Plex owner for admin', () => {
    assert.equal(formatPlexHomeRole('admin'), 'Plex owner');
  });
  it('returns Managed member for managed', () => {
    assert.equal(formatPlexHomeRole('managed'), 'Managed member');
  });
  it('returns Home user for home', () => {
    assert.equal(formatPlexHomeRole('home'), 'Home user');
  });
  it('returns Shared friend for friend', () => {
    assert.equal(formatPlexHomeRole('friend'), 'Shared friend');
  });
  it('returns Home user for null', () => {
    assert.equal(formatPlexHomeRole(null), 'Home user');
  });
  it('capitalises unknown roles', () => {
    const result = formatPlexHomeRole('guest');
    assert.equal(result[0], result[0].toUpperCase());
  });
  it('does not expose raw internal role names for known roles', () => {
    assert.notEqual(formatPlexHomeRole('admin'), 'admin');
    assert.notEqual(formatPlexHomeRole('managed'), 'managed');
  });
});

describe('formatPlexLibraryAccessState', () => {
  it('returns Confirmed for confirmed', () => {
    assert.equal(formatPlexLibraryAccessState('confirmed'), 'Confirmed');
  });
  it('returns Unconfirmed for unconfirmed', () => {
    assert.equal(formatPlexLibraryAccessState('unconfirmed'), 'Unconfirmed');
  });
  it('returns No access for denied', () => {
    assert.equal(formatPlexLibraryAccessState('denied'), 'No access');
  });
  it('returns Unknown for null', () => {
    assert.equal(formatPlexLibraryAccessState(null), 'Unknown');
  });
  it('capitalises unknown states', () => {
    const result = formatPlexLibraryAccessState('pending_review');
    assert.equal(result[0], result[0].toUpperCase());
  });
  it('does not expose raw "denied" backend value', () => {
    assert.notEqual(formatPlexLibraryAccessState('denied').toLowerCase(), 'denied');
  });
});

describe('formatPlexConflictReason', () => {
  it('returns empty string for null', () => {
    assert.equal(formatPlexConflictReason(null), '');
  });
  it('returns empty string for undefined', () => {
    assert.equal(formatPlexConflictReason(undefined), '');
  });
  it('formats username_match', () => {
    assert.equal(formatPlexConflictReason('username_match'), 'username already exists');
  });
  it('formats email_match', () => {
    assert.equal(formatPlexConflictReason('email_match'), 'email already linked');
  });
  it('formats plex_id_match', () => {
    assert.equal(formatPlexConflictReason('plex_id_match'), 'Plex account already linked');
  });
  it('replaces underscores with spaces for unknown reasons', () => {
    assert.ok(!formatPlexConflictReason('some_reason').includes('_'));
  });
  it('does not expose raw enum values for known reasons', () => {
    assert.notEqual(formatPlexConflictReason('username_match'), 'username_match');
  });
});
