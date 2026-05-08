/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import { usePwaUpdate, _resetPwaUpdateState } from '../../src/client/composables/usePwaUpdate.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a mock createRegistration factory capturing calls and allowing control. */
function makeRegistrationFactory() {
  let _onUpdateAvailable = null;
  let applyUpdateCalled = false;

  const factory = () => ({
    init({ onUpdateAvailable } = {}) {
      _onUpdateAvailable = onUpdateAvailable;
      return Promise.resolve();
    },
    applyUpdate() {
      applyUpdateCalled = true;
    },
  });

  return {
    factory,
    triggerUpdate() {
      _onUpdateAvailable?.();
    },
    get applyUpdateCalled() {
      return applyUpdateCalled;
    },
  };
}

// Reset shared module state before each test so tests are independent.
beforeEach(() => {
  _resetPwaUpdateState();
});

// ── Disabled (dev mode) ───────────────────────────────────────────────────────

describe('usePwaUpdate: disabled (enabled=false)', () => {
  it('isUpdateAvailable starts false', () => {
    const { isUpdateAvailable } = usePwaUpdate({ enabled: false });
    assert.equal(isUpdateAvailable.value, false);
  });

  it('does not call createRegistration when disabled', () => {
    let factoryCalled = false;
    usePwaUpdate({
      enabled: false,
      createRegistration: () => {
        factoryCalled = true;
        return { init: async () => {}, applyUpdate: () => {} };
      },
    });
    assert.equal(factoryCalled, false);
  });

  it('applyUpdate is a no-op when disabled', () => {
    const { applyUpdate } = usePwaUpdate({ enabled: false });
    assert.doesNotThrow(() => applyUpdate());
  });
});

// ── Enabled (production) ─────────────────────────────────────────────────────

describe('usePwaUpdate: enabled', () => {
  it('isUpdateAvailable is false before any update signal', () => {
    const spy = makeRegistrationFactory();
    const { isUpdateAvailable } = usePwaUpdate({ enabled: true, createRegistration: spy.factory });
    assert.equal(isUpdateAvailable.value, false);
  });

  it('isUpdateAvailable becomes true when onUpdateAvailable fires', () => {
    const spy = makeRegistrationFactory();
    const { isUpdateAvailable } = usePwaUpdate({ enabled: true, createRegistration: spy.factory });

    spy.triggerUpdate();

    assert.equal(isUpdateAvailable.value, true);
  });

  it('isUpdateAvailable cannot be mutated from outside the composable', () => {
    const spy = makeRegistrationFactory();
    const { isUpdateAvailable } = usePwaUpdate({ enabled: true, createRegistration: spy.factory });

    // Vue 3 readonly refs silently ignore external writes (with a dev warning).
    // The value must stay false — it cannot be set to true from the outside.
    isUpdateAvailable.value = true; // attempt — should be silently ignored
    assert.equal(isUpdateAvailable.value, false);
  });

  it('applyUpdate delegates to the registration', () => {
    const spy = makeRegistrationFactory();
    const { applyUpdate } = usePwaUpdate({ enabled: true, createRegistration: spy.factory });

    applyUpdate();

    assert.equal(spy.applyUpdateCalled, true);
  });
});

// ── Singleton initialization ──────────────────────────────────────────────────

describe('usePwaUpdate: singleton behavior', () => {
  it('createRegistration is called only once across multiple usePwaUpdate() calls', () => {
    let factoryCalls = 0;
    const factory = () => {
      factoryCalls++;
      return { init: async () => {}, applyUpdate: () => {} };
    };

    usePwaUpdate({ enabled: true, createRegistration: factory });
    usePwaUpdate({ enabled: true, createRegistration: factory });
    usePwaUpdate({ enabled: true, createRegistration: factory });

    assert.equal(factoryCalls, 1);
  });

  it('isUpdateAvailable state is shared across multiple calls', () => {
    const spy = makeRegistrationFactory();

    const first = usePwaUpdate({ enabled: true, createRegistration: spy.factory });
    const second = usePwaUpdate({ enabled: true, createRegistration: spy.factory });

    assert.equal(first.isUpdateAvailable, second.isUpdateAvailable);

    spy.triggerUpdate();

    assert.equal(first.isUpdateAvailable.value, true);
    assert.equal(second.isUpdateAvailable.value, true);
  });
});

// ── _resetPwaUpdateState (test utility) ──────────────────────────────────────

describe('usePwaUpdate: _resetPwaUpdateState', () => {
  it('resets isUpdateAvailable to false after triggering an update', () => {
    const spy = makeRegistrationFactory();
    const { isUpdateAvailable } = usePwaUpdate({ enabled: true, createRegistration: spy.factory });

    spy.triggerUpdate();
    assert.equal(isUpdateAvailable.value, true);

    _resetPwaUpdateState();

    // Must create a new instance after reset — the old ref is stale
    const { isUpdateAvailable: fresh } = usePwaUpdate({ enabled: false });
    assert.equal(fresh.value, false);
  });

  it('allows re-initialization after reset', () => {
    let factoryCalls = 0;
    const factory = () => {
      factoryCalls++;
      return { init: async () => {}, applyUpdate: () => {} };
    };

    usePwaUpdate({ enabled: true, createRegistration: factory });
    assert.equal(factoryCalls, 1);

    _resetPwaUpdateState();

    usePwaUpdate({ enabled: true, createRegistration: factory });
    assert.equal(factoryCalls, 2);
  });
});
