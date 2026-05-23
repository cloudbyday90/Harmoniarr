import assert from 'node:assert/strict';
import test from 'node:test';
import { ref } from 'vue';
import { useNotificationCategories } from '../../src/client/composables/useNotificationCategories.js';

function createMockAccountPreferences({ notificationPreferences = {} } = {}) {
  const preferences = ref({ preferredFormat: 'any', minimumQuality: 'any', notificationPreferences: { ...notificationPreferences } });

  return {
    preferences,
    isLoading: ref(false),
    errorMessage: ref(null),
    async loadPreferences() {},
    async savePreferences(patch) {
      preferences.value = {
        ...preferences.value,
        notificationPreferences: {
          ...preferences.value.notificationPreferences,
          ...patch.notificationPreferences,
        },
      };
    },
  };
}

test('useNotificationCategories visibleCategories filters admin-only for non-admin', () => {
  const { visibleCategories } = useNotificationCategories({
    useAccountPreferencesFn: createMockAccountPreferences,
    isAdminFn: () => false,
  });

  const keys = visibleCategories.value.map((c) => c.key);
  assert.ok(!keys.includes('trustOverride'));
  assert.ok(!keys.includes('blocklistEvent'));
  assert.ok(keys.includes('requestFulfilled'));
});

test('useNotificationCategories visibleCategories includes admin-only for admin', () => {
  const { visibleCategories } = useNotificationCategories({
    useAccountPreferencesFn: createMockAccountPreferences,
    isAdminFn: () => true,
  });

  const keys = visibleCategories.value.map((c) => c.key);
  assert.ok(keys.includes('trustOverride'));
  assert.ok(keys.includes('blocklistEvent'));
  assert.ok(keys.includes('requestFulfilled'));
});

test('useNotificationCategories getEffectiveValue defaults to true for unknown keys', () => {
  const { getEffectiveValue } = useNotificationCategories({
    useAccountPreferencesFn: createMockAccountPreferences,
    isAdminFn: () => false,
  });

  assert.equal(getEffectiveValue('unknownKey'), true);
});

test('useNotificationCategories getEffectiveValue returns false when preference is explicitly false', () => {
  const { getEffectiveValue } = useNotificationCategories({
    useAccountPreferencesFn: () => createMockAccountPreferences({ notificationPreferences: { requestFulfilled: false } }),
    isAdminFn: () => false,
  });

  assert.equal(getEffectiveValue('requestFulfilled'), false);
});

test('useNotificationCategories toggleCategory flips value and persists', async () => {
  const mockPrefs = createMockAccountPreferences({ notificationPreferences: { requestFulfilled: true } });
  const { getEffectiveValue, toggleCategory } = useNotificationCategories({
    useAccountPreferencesFn: () => mockPrefs,
    isAdminFn: () => false,
  });

  assert.equal(getEffectiveValue('requestFulfilled'), true);

  await toggleCategory('requestFulfilled');

  assert.equal(getEffectiveValue('requestFulfilled'), false);
});

test('useNotificationCategories toggleCategory reverts on save failure', async () => {
  const mockPrefs = createMockAccountPreferences({ notificationPreferences: { requestFulfilled: true } });
  mockPrefs.savePreferences = async () => { throw new Error('fail'); };

  const { getEffectiveValue, toggleCategory } = useNotificationCategories({
    useAccountPreferencesFn: () => mockPrefs,
    isAdminFn: () => false,
  });

  await toggleCategory('requestFulfilled');

  assert.equal(getEffectiveValue('requestFulfilled'), true);
});

test('useNotificationCategories isPending returns true during toggle', async () => {
  let resolveSave;
  const mockPrefs = createMockAccountPreferences({ notificationPreferences: { requestFulfilled: true } });
  mockPrefs.savePreferences = () => new Promise((resolve) => { resolveSave = resolve; });

  const { isPending, toggleCategory } = useNotificationCategories({
    useAccountPreferencesFn: () => mockPrefs,
    isAdminFn: () => false,
  });

  const p = toggleCategory('requestFulfilled');
  assert.equal(isPending('requestFulfilled'), true);

  resolveSave();
  await p;

  assert.equal(isPending('requestFulfilled'), false);
});

test('useNotificationCategories delegates loadPreferences and errorMessage', async () => {
  const mockPrefs = createMockAccountPreferences();
  let loadCalled = false;
  const origLoad = mockPrefs.loadPreferences.bind(mockPrefs);
  mockPrefs.loadPreferences = async () => { loadCalled = true; await origLoad(); };

  const { loadPreferences, errorMessage } = useNotificationCategories({
    useAccountPreferencesFn: () => mockPrefs,
    isAdminFn: () => false,
  });

  await loadPreferences();
  assert.equal(loadCalled, true);
  assert.equal(errorMessage.value, null);
});
