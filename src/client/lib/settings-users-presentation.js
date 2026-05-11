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

export function formatUserRole(role) {
  if (!role || typeof role !== 'string') return 'Unknown';
  switch (role.toLowerCase()) {
    case 'admin': return 'Admin';
    case 'operator': return 'Operator';
    case 'requester': return 'Requester';
    default: return role.charAt(0).toUpperCase() + role.slice(1);
  }
}

export function formatAuthProvider(provider) {
  if (!provider || typeof provider !== 'string') return 'password';
  switch (provider.toLowerCase()) {
    case 'plex': return 'Plex';
    case 'local': return 'password';
    default: return 'password';
  }
}

export function buildUsersEmptyStateBody() {
  return "Once you've added users, their accounts will appear here. You can link Plex accounts and set up personal library folders from each user's card.";
}

export function formatPlexLinkStatusDetail(plexStatus) {
  if (!plexStatus?.linked) return null;
  if (plexStatus.linkedUserTitle && plexStatus.linkedUserEmail) {
    return `Linked as ${plexStatus.linkedUserTitle} (${plexStatus.linkedUserEmail})`;
  }
  return plexStatus.linkedUserTitle ? `Linked as ${plexStatus.linkedUserTitle}` : 'Linked';
}

export function plexLibraryAccessPolicyLabel(policy) {
  switch (policy?.classification) {
    case 'eligible': return 'Eligible';
    case 'review_required': return 'Needs review';
    default: return 'Unknown';
  }
}

export function plexLibraryAccessPolicyTone(policy) {
  switch (policy?.classification) {
    case 'eligible': return 'success';
    case 'review_required': return 'warning';
    default: return 'danger';
  }
}

export function describePlexLibraryAccessPolicy(policy) {
  switch (policy?.reasonCode) {
    case 'plex_owner_access':
      return 'This is the Plex owner — they have confirmed server access and can be imported without review.';
    case 'plex_shared_library_access':
      return `This user has confirmed shared library access${policy.serverCount > 0 ? ` across ${policy.serverCount} server${policy.serverCount === 1 ? '' : 's'}` : ''} and can be imported.`;
    case 'plex_managed_access_unconfirmed':
      return "This is a managed Plex home member, but shared library access isn't confirmed. Review before importing.";
    case 'plex_member_access_unconfirmed':
      return "This Plex home member exists, but shared library visibility isn't confirmed in this preview. Review before importing.";
    default:
      return 'Plex access details are incomplete. Review before importing.';
  }
}

export function describePlexLocalAuthStatus(user) {
  if (user?.localAuth?.unlinkPlexReady) {
    const changedAt = user.localAuth.passwordChangedAt
      ? ` since ${new Date(user.localAuth.passwordChangedAt).toLocaleString()}`
      : '';
    const changeNotice = user.localAuth.mustChangePassword
      ? ' The user will still be prompted to change that password on next login.'
      : '';
    return `Local sign-in is ready${changedAt}. You can safely remove the Plex link without deleting the app user.${changeNotice}`;
  }
  return 'Unlink is blocked until a temporary password is set or the user completes account claim with a local password.';
}

export function hasPendingManagedLibraryRootChanges(user) {
  return (user?.pendingManagedLibraryRelativeRoot ?? '') !== (user?.managedLibraryRelativeRoot ?? '');
}

export function formatPlexProfileClassification(classification) {
  switch (classification) {
    case 'create': return 'Ready to import';
    case 'linked': return 'Already linked';
    case 'conflict': return 'Needs review';
    case 'owner': return 'Owner (skipped)';
    default: return classification ?? 'Unknown';
  }
}

export function formatPlexProfileClassificationClass(classification) {
  switch (classification) {
    case 'create': return 'review-status-selected';
    case 'linked': return 'review-status-held';
    default: return 'review-status-failed';
  }
}

export function formatPlexHomeRole(homeRole) {
  if (!homeRole || typeof homeRole !== 'string') return 'Home user';
  switch (homeRole.toLowerCase()) {
    case 'admin': return 'Plex owner';
    case 'managed': return 'Managed member';
    case 'home': return 'Home user';
    case 'friend': return 'Shared friend';
    default: return homeRole.charAt(0).toUpperCase() + homeRole.slice(1).replace(/_/g, ' ');
  }
}

export function formatPlexLibraryAccessState(state) {
  if (!state || typeof state !== 'string') return 'Unknown';
  switch (state.toLowerCase()) {
    case 'confirmed': return 'Confirmed';
    case 'unconfirmed': return 'Unconfirmed';
    case 'denied': return 'No access';
    default: return state.charAt(0).toUpperCase() + state.slice(1).replace(/_/g, ' ');
  }
}

export function formatPlexConflictReason(reason) {
  if (!reason || typeof reason !== 'string') return '';
  switch (reason.toLowerCase()) {
    case 'username_match': return 'username already exists';
    case 'email_match': return 'email already linked';
    case 'plex_id_match': return 'Plex account already linked';
    default: return reason.replace(/_/g, ' ');
  }
}
