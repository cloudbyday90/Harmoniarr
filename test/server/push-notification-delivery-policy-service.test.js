import assert from 'node:assert/strict';
import test from 'node:test';
import { createPushNotificationDeliveryPolicyService } from '../../src/server/push/push-notification-delivery-policy-service.js';

const account = (overrides = {}) => ({ id: 'user-1', isDisabled: false, role: 'requester', userPreferences: {}, ...overrides });
function createPolicy(read = async () => account()) {
  return createPushNotificationDeliveryPolicyService({ pushNotificationDeliveryPolicyStore: { getDeliveryAccount: read } });
}
const request = { userId: 'user-1', eventType: 'releaseAdded' };

test('delivery policy reads the current recipient on every attempt and preserves valid enabled defaults', async () => {
  let current = account();
  let reads = 0;
  const service = createPolicy(async (input) => { assert.deepEqual(input, { userId: 'user-1' }); reads++; return current; });
  for (const userPreferences of [{}, { preferredFormat: 'flac' }, { notificationPreferences: {} },
    { notificationPreferences: { releaseAdded: true } }]) {
    current = account({ userPreferences });
    assert.deepEqual(await service.getDeliveryDecision(request), { allowed: true, retryable: false, reason: 'enabled' });
  }
  current = account({ userPreferences: { notificationPreferences: { releaseAdded: false } } });
  assert.deepEqual(await service.getDeliveryDecision(request), { allowed: false, retryable: false, reason: 'preference_disabled' });
  assert.equal(reads, 5);
});

test('delivery policy rejects unknown, generic, missing, and prototype event names without reading account state', async () => {
  const service = createPolicy(async () => { assert.fail('unknown categories cannot read or authorize an account'); });
  for (const eventType of [undefined, null, '', 'generic', 'unknown', 'constructor', '__proto__', 'toString']) {
    assert.deepEqual(await service.getDeliveryDecision({ ...request, eventType }),
      { allowed: false, retryable: false, reason: 'unknown_category' });
  }
});

test('delivery policy suppresses missing, disabled, wrongly identified, and ineligible accounts', async () => {
  for (const [value, reason] of [[null, 'missing_account'], [account({ id: 'another-user' }), 'missing_account'],
    [account({ isDisabled: true }), 'disabled_account'], [account({ role: 'unexpected' }), 'ineligible_role']]) {
    assert.deepEqual(await createPolicy(async () => value).getDeliveryDecision(request),
      { allowed: false, retryable: false, reason });
  }
  for (const isDisabled of [undefined, null, 'false', 0]) {
    assert.deepEqual(await createPolicy(async () => account({ isDisabled })).getDeliveryDecision(request),
      { allowed: false, retryable: true, reason: 'account_unavailable' });
  }
});

test('admin-only delivery follows the current role and does not reuse an earlier admin decision', async () => {
  let role = 'admin';
  const service = createPolicy(async () => account({ role }));
  const input = { ...request, eventType: 'trustOverride' };
  assert.equal((await service.getDeliveryDecision(input)).allowed, true);
  for (role of ['operator', 'requester']) {
    assert.deepEqual(await service.getDeliveryDecision(input), { allowed: false, retryable: false, reason: 'ineligible_role' });
  }
});

test('malformed raw preferences cannot become enabled defaults and remain retryable without raw data', async () => {
  for (const userPreferences of [null, undefined, [], false, 'private-value',
    { notificationPreferences: null }, { notificationPreferences: [] },
    { notificationPreferences: { releaseAdded: 'true' } }, { notificationPreferences: { releaseAdded: null } }]) {
    assert.deepEqual(await createPolicy(async () => account({ userPreferences })).getDeliveryDecision(request),
      { allowed: false, retryable: true, reason: 'preferences_unavailable' });
  }
  assert.deepEqual(await createPolicy(async () => { throw new Error('private database credential'); }).getDeliveryDecision(request),
    { allowed: false, retryable: true, reason: 'account_unavailable' });
});
