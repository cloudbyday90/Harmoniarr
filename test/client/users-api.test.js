import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createUser,
  fetchPlexLinkedAccountsOverview,
  fetchUsers,
  provisionUserManagedLibraryRoot,
  updateUser,
} from '../../src/client/lib/users-api.js';

function createJsonResponse({ ok = true, payload = { ok: true }, status = 200 } = {}) {
  return {
    ok,
    status,
    headers: {
      get(name) {
        return name.toLowerCase() === 'content-type' ? 'application/json' : null;
      },
    },
    async json() {
      return payload;
    },
    async text() {
      return JSON.stringify(payload);
    },
  };
}

test('users-api routes list, create, and update requests through the shared api client contract', async (t) => {
  globalThis.document = { cookie: 'harmoniarr_csrf=csrf-users' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse());

  await fetchUsers();
  await fetchPlexLinkedAccountsOverview();
  await createUser({ username: 'listener', password: 'password-1234', role: 'requester' });
  await updateUser('user-1', { role: 'operator', isDisabled: true });
  await provisionUserManagedLibraryRoot('user-1');

  assert.equal(globalThis.fetch.mock.callCount(), 5);
  assert.equal(globalThis.fetch.mock.calls[0].arguments[0], '/api/v1/users');
  assert.equal(globalThis.fetch.mock.calls[0].arguments[1].method, 'GET');
  assert.equal(globalThis.fetch.mock.calls[1].arguments[0], '/api/v1/users/linked-accounts/plex');
  assert.equal(globalThis.fetch.mock.calls[1].arguments[1].method, 'GET');
  assert.equal(globalThis.fetch.mock.calls[2].arguments[0], '/api/v1/users');
  assert.equal(globalThis.fetch.mock.calls[2].arguments[1].method, 'POST');
  assert.equal(globalThis.fetch.mock.calls[2].arguments[1].headers.get('X-CSRF-Token'), 'csrf-users');
  assert.equal(globalThis.fetch.mock.calls[3].arguments[0], '/api/v1/users/user-1');
  assert.equal(globalThis.fetch.mock.calls[3].arguments[1].method, 'PATCH');
  assert.equal(globalThis.fetch.mock.calls[3].arguments[1].headers.get('X-CSRF-Token'), 'csrf-users');
  assert.equal(globalThis.fetch.mock.calls[4].arguments[0], '/api/v1/users/user-1/provision-managed-library-root');
  assert.equal(globalThis.fetch.mock.calls[4].arguments[1].method, 'POST');
  assert.equal(globalThis.fetch.mock.calls[4].arguments[1].headers.get('X-CSRF-Token'), 'csrf-users');
});
