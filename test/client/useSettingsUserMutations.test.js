import assert from 'node:assert/strict';
import test from 'node:test';
import { ref } from 'vue';
import { useSettingsUserMutations } from '../../src/client/composables/useSettingsUserMutations.js';

function createDependencies(overrides = {}) {
  const users = ref([]);
  let loadUsersCalled = false;
  let plexOverviewCalled = false;

  return {
    users,
    loadUsersCalled: () => loadUsersCalled,
    plexOverviewCalled: () => plexOverviewCalled,
    loadUsers: async () => { loadUsersCalled = true; },
    loadPlexLinkedAccountsOverview: async () => { plexOverviewCalled = true; },
    ...overrides,
  };
}

test('useSettingsUserMutations toEditableUser adds editing state', () => {
  const deps = createDependencies();
  const { toEditableUser } = useSettingsUserMutations(deps);

  const editable = toEditableUser({ id: 'u-1', username: 'alice', role: 'admin', isDisabled: false });

  assert.equal(editable.id, 'u-1');
  assert.equal(editable.username, 'alice');
  assert.equal(editable.pendingRole, 'admin');
  assert.equal(editable.pendingIsDisabled, false);
  assert.equal(editable.pendingManagedLibraryRelativeRoot, '');
  assert.equal(editable.saving, false);
  assert.equal(editable.provisioning, false);
  assert.equal(editable.resettingPassword, false);
  assert.equal(editable.issuingClaimCode, false);
  assert.equal(editable.unlinkingPlex, false);
  assert.equal(editable.claimCode, null);
  assert.equal(editable.claimCodeExpiresAt, null);
});

test('useSettingsUserMutations toEditableUser accepts overrides', () => {
  const deps = createDependencies();
  const { toEditableUser } = useSettingsUserMutations(deps);

  const editable = toEditableUser({ id: 'u-1', role: 'admin', isDisabled: false }, {
    claimCode: 'ABC123',
    claimCodeExpiresAt: '2026-06-01T00:00:00Z',
  });

  assert.equal(editable.claimCode, 'ABC123');
  assert.equal(editable.claimCodeExpiresAt, '2026-06-01T00:00:00Z');
});

test('useSettingsUserMutations toEditableUser handles null managedLibraryRelativeRoot', () => {
  const deps = createDependencies();
  const { toEditableUser } = useSettingsUserMutations(deps);

  const editable = toEditableUser({ id: 'u-1', role: 'admin', isDisabled: false, managedLibraryRelativeRoot: null });

  assert.equal(editable.pendingManagedLibraryRelativeRoot, '');
});

test('useSettingsUserMutations resetNewUserForm clears form fields', () => {
  const deps = createDependencies();
  const { newUserForm, resetNewUserForm } = useSettingsUserMutations(deps);

  newUserForm.username = 'alice';
  newUserForm.password = 'secret';
  newUserForm.managedLibraryRelativeRoot = 'family/alice';
  newUserForm.role = 'admin';

  resetNewUserForm();

  assert.equal(newUserForm.username, '');
  assert.equal(newUserForm.password, '');
  assert.equal(newUserForm.managedLibraryRelativeRoot, '');
  assert.equal(newUserForm.role, 'requester');
});

test('useSettingsUserMutations saveNewUser creates user and reloads', async () => {
  const deps = createDependencies({
    createUserFn: async () => ({ user: { id: 'u-new', username: 'alice', role: 'requester', isDisabled: false } }),
  });
  const { saveNewUser, isCreatingUser, successMessage, errorMessage } = useSettingsUserMutations(deps);

  await saveNewUser();

  assert.equal(isCreatingUser.value, false);
  assert.equal(successMessage.value, 'User alice created.');
  assert.equal(errorMessage.value, '');
  assert.equal(deps.loadUsersCalled(), true);
});

test('useSettingsUserMutations saveNewUser sets error on failure', async () => {
  const deps = createDependencies({
    createUserFn: async () => { throw new Error('Creation failed'); },
  });
  const { saveNewUser, errorMessage, isCreatingUser } = useSettingsUserMutations(deps);

  await saveNewUser();

  assert.equal(errorMessage.value, 'Creation failed');
  assert.equal(isCreatingUser.value, false);
});

test('useSettingsUserMutations saveManagedUser updates user entry', async () => {
  const deps = createDependencies({
    updateUserFn: async () => ({ user: { id: 'u-1', username: 'alice', role: 'operator', isDisabled: false } }),
  });
  deps.users.value = [{
    id: 'u-1', username: 'alice', role: 'admin', isDisabled: false, saving: true,
    pendingRole: 'operator', pendingIsDisabled: false, pendingManagedLibraryRelativeRoot: '',
    claimCode: null, claimCodeExpiresAt: null,
  }];

  const { saveManagedUser, successMessage } = useSettingsUserMutations(deps);
  const user = deps.users.value[0];

  await saveManagedUser(user);

  assert.equal(successMessage.value, 'User alice updated.');
  assert.equal(deps.users.value[0].role, 'operator');
  assert.equal(deps.users.value[0].saving, false);
});

test('useSettingsUserMutations saveManagedUser preserves claim code', async () => {
  const deps = createDependencies({
    updateUserFn: async () => ({ user: { id: 'u-1', username: 'alice', role: 'admin', isDisabled: false } }),
  });
  deps.users.value = [{
    id: 'u-1', username: 'alice', role: 'admin', isDisabled: false, saving: true,
    pendingRole: 'admin', pendingIsDisabled: false, pendingManagedLibraryRelativeRoot: '',
    claimCode: 'XYZ789', claimCodeExpiresAt: '2026-07-01T00:00:00Z',
  }];

  const { saveManagedUser } = useSettingsUserMutations(deps);
  await saveManagedUser(deps.users.value[0]);

  assert.equal(deps.users.value[0].claimCode, 'XYZ789');
  assert.equal(deps.users.value[0].claimCodeExpiresAt, '2026-07-01T00:00:00Z');
});

test('useSettingsUserMutations saveManagedUser resets saving on error', async () => {
  const deps = createDependencies({
    updateUserFn: async () => { throw new Error('Update failed'); },
  });
  deps.users.value = [{
    id: 'u-1', username: 'alice', role: 'admin', isDisabled: false, saving: true,
    pendingRole: 'admin', pendingIsDisabled: false, pendingManagedLibraryRelativeRoot: '',
  }];

  const { saveManagedUser, errorMessage } = useSettingsUserMutations(deps);
  await saveManagedUser(deps.users.value[0]);

  assert.equal(errorMessage.value, 'Update failed');
  assert.equal(deps.users.value[0].saving, false);
});

test('useSettingsUserMutations disconnectPlexLink clears and reloads', async () => {
  let clearCalled = false;
  const deps = createDependencies({
    clearPlexLinkFn: async () => { clearCalled = true; },
  });

  const { disconnectPlexLink, isClearingPlexLink, successMessage } = useSettingsUserMutations(deps);

  await disconnectPlexLink();

  assert.equal(clearCalled, true);
  assert.equal(isClearingPlexLink.value, false);
  assert.equal(successMessage.value, 'Plex owner link cleared.');
  assert.equal(deps.plexOverviewCalled(), true);
});

test('useSettingsUserMutations importPlexUsersNow imports and reloads', async () => {
  const deps = createDependencies({
    applyPlexUserImportFn: async () => ({ summary: { created: 3, updated: 1 } }),
  });

  const { importPlexUsersNow, isImportingPlexUsers, successMessage } = useSettingsUserMutations(deps);

  await importPlexUsersNow();

  assert.equal(isImportingPlexUsers.value, false);
  assert.equal(successMessage.value, 'Plex user import applied. Created 3, refreshed 1.');
  assert.equal(deps.loadUsersCalled(), true);
  assert.equal(deps.plexOverviewCalled(), true);
});

test('useSettingsUserMutations relinkPlexConflict relinks and reloads', async () => {
  const deps = createDependencies({
    relinkPlexUserConflictFn: async () => ({
      profile: { title: 'PlexUser' },
      user: { username: 'alice' },
    }),
  });

  const { relinkPlexConflict, activePlexRelinkProfileId, successMessage } = useSettingsUserMutations(deps);

  await relinkPlexConflict({ id: 'p-1', existingUser: { id: 'u-1' } });

  assert.equal(successMessage.value, 'Linked Plex profile PlexUser to alice.');
  assert.equal(activePlexRelinkProfileId.value, '');
  assert.equal(deps.loadUsersCalled(), true);
});

test('useSettingsUserMutations relinkPlexConflict is no-op without profile', async () => {
  const { relinkPlexConflict, errorMessage } = useSettingsUserMutations(createDependencies());

  await relinkPlexConflict({ id: 'p-1' });
  await relinkPlexConflict({ existingUser: { id: 'u-1' } });

  assert.equal(errorMessage.value, '');
});

test('useSettingsUserMutations findEditableUser looks up by id', () => {
  const deps = createDependencies();
  deps.users.value = [{ id: 'u-1', username: 'alice' }];

  const { findEditableUser } = useSettingsUserMutations(deps);

  assert.equal(findEditableUser('u-1')?.username, 'alice');
  assert.equal(findEditableUser('u-missing'), null);
});

test('useSettingsUserMutations isPlexLinkedAccountActionPending tracks active action', () => {
  const deps = createDependencies();
  const { isPlexLinkedAccountActionPending } = useSettingsUserMutations(deps);

  assert.equal(isPlexLinkedAccountActionPending('u-1', 'mark_stale'), false);
});

test('useSettingsUserMutations resetManagedUserPassword resets user', async () => {
  const deps = createDependencies({
    resetUserPasswordFn: async () => ({ user: { id: 'u-1', username: 'alice', role: 'admin', isDisabled: false } }),
  });
  const user = {
    id: 'u-1', username: 'alice', role: 'admin', isDisabled: false,
    resettingPassword: true, pendingPasswordReset: 'newpass',
    claimCode: null, claimCodeExpiresAt: null,
  };

  const { resetManagedUserPassword, successMessage } = useSettingsUserMutations(deps);
  await resetManagedUserPassword(user);

  assert.equal(successMessage.value, 'Temporary password set for alice. The user must change it on next login.');
});

test('useSettingsUserMutations issueManagedUserClaimCode issues code', async () => {
  const deps = createDependencies({
    issueUserClaimCodeFn: async () => ({
      user: { id: 'u-1', username: 'alice', role: 'admin', isDisabled: false },
      claimCode: 'CLAIM1',
      expiresAt: '2026-12-01T00:00:00Z',
    }),
  });
  const user = {
    id: 'u-1', username: 'alice', role: 'admin', isDisabled: false,
    issuingClaimCode: true, claimCode: null, claimCodeExpiresAt: null,
  };

  const { issueManagedUserClaimCode, successMessage } = useSettingsUserMutations(deps);
  await issueManagedUserClaimCode(user);

  assert.ok(successMessage.value.includes('Claim code issued for alice'));
});

test('useSettingsUserMutations unlinkManagedPlexUser unlinks and reloads overview', async () => {
  const deps = createDependencies({
    unlinkPlexUserFn: async () => ({ user: { id: 'u-1', username: 'alice', role: 'admin', isDisabled: false } }),
  });
  const user = {
    id: 'u-1', username: 'alice', role: 'admin', isDisabled: false,
    unlinkingPlex: true, claimCode: null, claimCodeExpiresAt: null,
  };

  const { unlinkManagedPlexUser, successMessage } = useSettingsUserMutations(deps);
  await unlinkManagedPlexUser(user);

  assert.equal(successMessage.value, 'Plex link removed for alice. Local sign-in remains available.');
  assert.equal(deps.plexOverviewCalled(), true);
});

test('useSettingsUserMutations provisionManagedUserLibraryRoot provisions folder', async () => {
  const deps = createDependencies({
    provisionUserManagedLibraryRootFn: async () => ({
      user: { id: 'u-1', username: 'alice', role: 'admin', isDisabled: false },
      provisioning: { created: true },
    }),
  });
  const user = {
    id: 'u-1', username: 'alice', role: 'admin', isDisabled: false,
    provisioning: true, claimCode: null, claimCodeExpiresAt: null,
  };

  const { provisionManagedUserLibraryRoot, successMessage } = useSettingsUserMutations(deps);
  await provisionManagedUserLibraryRoot(user);

  assert.equal(successMessage.value, 'Managed library folder provisioned for alice.');
});

test('useSettingsUserMutations runPlexLinkedAccountAction marks stale', async () => {
  const deps = createDependencies({
    reconcilePlexLinkedAccountFn: async () => ({
      user: { id: 'u-1', username: 'alice' },
    }),
  });

  const { runPlexLinkedAccountAction, successMessage } = useSettingsUserMutations(deps);
  await runPlexLinkedAccountAction({ id: 'u-1', username: 'alice' }, 'mark_stale');

  assert.equal(successMessage.value, 'Marked alice as a reviewed stale Plex link.');
  assert.equal(deps.loadUsersCalled(), true);
});

test('useSettingsUserMutations runPlexLinkedAccountAction is no-op without id', async () => {
  const deps = createDependencies();
  const { runPlexLinkedAccountAction, errorMessage } = useSettingsUserMutations(deps);

  await runPlexLinkedAccountAction({}, 'mark_stale');
  await runPlexLinkedAccountAction(null, 'mark_stale');

  assert.equal(errorMessage.value, '');
});

test('useSettingsUserMutations roleOptions defaults to admin/operator/requester', () => {
  const { roleOptions } = useSettingsUserMutations(createDependencies());

  assert.deepEqual(roleOptions.value, ['admin', 'operator', 'requester']);
});
