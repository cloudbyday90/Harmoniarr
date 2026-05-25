import assert from 'node:assert/strict';
import test from 'node:test';
import { NavigationFailureType } from 'vue-router';
import { navigateAfterAuthSuccess } from '../../src/client/lib/auth-navigation.js';

function createRouterDouble({
  currentFullPath = '/login',
  currentPath = '/login',
  href = '/app',
  fullPath = '/app',
  path = '/app',
  replaceImpl = null,
} = {}) {
  const router = {
    currentRoute: {
      value: {
        fullPath: currentFullPath,
        path: currentPath,
      },
    },
    resolve(target) {
      return {
        fullPath,
        href,
        path,
        target,
      };
    },
    replace: async (target) => {
      if (typeof replaceImpl === 'function') {
        return replaceImpl(target, router);
      }

      router.currentRoute.value = {
        fullPath,
        path,
      };
      return undefined;
    },
  };

  return router;
}

function createWindowDouble() {
  return {
    location: {
      assignCalls: [],
      replaceCalls: [],
      assign(href) {
        this.assignCalls.push(href);
      },
      replace(href) {
        this.replaceCalls.push(href);
      },
    },
  };
}

test('navigateAfterAuthSuccess uses router.replace when SPA navigation succeeds', async () => {
  const router = createRouterDouble();
  const windowObject = createWindowDouble();

  const result = await navigateAfterAuthSuccess({
    router,
    target: { name: 'dashboard' },
    windowObject,
  });

  assert.equal(result.usedDocumentNavigation, false);
  assert.deepEqual(windowObject.location.replaceCalls, []);
});

test('navigateAfterAuthSuccess accepts duplicated navigation when already at the resolved target', async () => {
  const router = createRouterDouble({
    currentFullPath: '/app',
    currentPath: '/app',
    replaceImpl: async () => ({
      type: NavigationFailureType.duplicated,
    }),
  });
  const windowObject = createWindowDouble();

  const result = await navigateAfterAuthSuccess({
    router,
    target: { name: 'dashboard' },
    windowObject,
  });

  assert.equal(result.usedDocumentNavigation, false);
  assert.deepEqual(windowObject.location.replaceCalls, []);
});

test('navigateAfterAuthSuccess falls back to document navigation when router navigation does not leave login', async () => {
  const router = createRouterDouble({
    replaceImpl: async () => undefined,
  });
  const windowObject = createWindowDouble();

  const result = await navigateAfterAuthSuccess({
    router,
    target: { name: 'dashboard' },
    windowObject,
  });

  assert.equal(result.usedDocumentNavigation, true);
  assert.deepEqual(windowObject.location.replaceCalls, ['/app']);
});

test('navigateAfterAuthSuccess falls back to document navigation when router.replace throws', async () => {
  const router = createRouterDouble({
    replaceImpl: async () => {
      throw new Error('chunk load failure');
    },
  });
  const windowObject = createWindowDouble();

  const result = await navigateAfterAuthSuccess({
    router,
    target: { name: 'dashboard' },
    windowObject,
  });

  assert.equal(result.usedDocumentNavigation, true);
  assert.deepEqual(windowObject.location.replaceCalls, ['/app']);
});
