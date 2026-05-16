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
import { describe, it } from 'node:test';
import { createPwaRegistration } from '../../src/client/lib/pwa-registration.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build a minimal mock ServiceWorker instance.
 * @param {'installing'|'installed'|'activating'|'activated'} initialState
 */
function makeWorker(initialState = 'installing') {
  const listeners = {};
  let state = initialState;
  return {
    get state() { return state; },
    setState(s) {
      state = s;
      listeners['statechange']?.forEach((fn) => {
        fn();
      });
    },
    addEventListener(type, fn) {
      listeners[type] ??= [];
      listeners[type].push(fn);
    },
    postMessage: null, // set per-test when needed
  };
}

/**
 * Build a mock ServiceWorkerRegistration.
 * @param {{ installing?: object, waiting?: object, active?: object }} workers
 */
function makeRegistration({ installing = null, waiting = null, active = null } = {}) {
  const listeners = {};
  const reg = {
    installing,
    waiting,
    active,
    addEventListener(type, fn) {
      listeners[type] ??= [];
      listeners[type].push(fn);
    },
    _fireUpdateFound(worker) {
      reg.installing = worker;
      listeners['updatefound']?.forEach((fn) => {
        fn();
      });
    },
  };
  return reg;
}

/** Build an injectable mock navigator.serviceWorker container. */
function makeServiceWorkerContainer({ registration, controller = {} }) {
  const listeners = {};
  return {
    controller,
    register: async () => registration,
    addEventListener(type, fn) {
      listeners[type] ??= [];
      listeners[type].push(fn);
    },
    _fireControllerChange() {
      listeners['controllerchange']?.forEach((fn) => {
        fn();
      });
    },
  };
}

/** Build a minimal mock navigator. */
function makeNav({ registration, controller = {} } = {}) {
  return {
    serviceWorker: makeServiceWorkerContainer({ registration, controller }),
  };
}

/** Build a mock window with a spy on location.reload. */
function makeWin() {
  let reloaded = false;
  return {
    location: { reload() { reloaded = true; } },
    get reloaded() { return reloaded; },
  };
}

// ── No serviceWorker support ──────────────────────────────────────────────────

describe('createPwaRegistration: no serviceWorker support', () => {
  it('init resolves without error when serviceWorker is not in nav', async () => {
    const reg = createPwaRegistration({ nav: {}, win: makeWin() });
    await assert.doesNotReject(() => reg.init({ onUpdateAvailable: () => {} }));
  });

  it('applyUpdate is a no-op when registration was never created', () => {
    const reg = createPwaRegistration({ nav: {}, win: makeWin() });
    assert.doesNotThrow(() => reg.applyUpdate());
  });
});

// ── Initial registration (no waiting SW) ─────────────────────────────────────

describe('createPwaRegistration: fresh install', () => {
  it('registers the service worker at the default path', async () => {
    let registeredPath;
    const registration = makeRegistration();
    const nav = makeNav({ registration });
    nav.serviceWorker.register = async (path) => {
      registeredPath = path;
      return registration;
    };

    const handle = createPwaRegistration({ nav, win: makeWin() });
    await handle.init({ onUpdateAvailable: () => {} });

    assert.equal(registeredPath, '/service-worker.js');
  });

  it('does not call onUpdateAvailable when there is no waiting SW', async () => {
    let called = false;
    const registration = makeRegistration({ waiting: null });
    const nav = makeNav({ registration, controller: {} });

    const handle = createPwaRegistration({ nav, win: makeWin() });
    await handle.init({ onUpdateAvailable: () => { called = true; } });

    assert.equal(called, false);
  });
});

// ── Waiting SW already present on page load ───────────────────────────────────

describe('createPwaRegistration: waiting SW on page load', () => {
  it('calls onUpdateAvailable when a waiting SW exists and a controller is active', async () => {
    let called = false;
    const waitingWorker = makeWorker('installed');
    const registration = makeRegistration({ waiting: waitingWorker });
    const nav = makeNav({ registration, controller: {} });

    const handle = createPwaRegistration({ nav, win: makeWin() });
    await handle.init({ onUpdateAvailable: () => { called = true; } });

    assert.equal(called, true);
  });

  it('does NOT call onUpdateAvailable when waiting SW exists but there is no controller (fresh install)', async () => {
    let called = false;
    const waitingWorker = makeWorker('installed');
    const registration = makeRegistration({ waiting: waitingWorker });
    const nav = makeNav({ registration, controller: null });

    const handle = createPwaRegistration({ nav, win: makeWin() });
    await handle.init({ onUpdateAvailable: () => { called = true; } });

    assert.equal(called, false);
  });
});

// ── updatefound → new SW installs and reaches 'installed' ────────────────────

describe('createPwaRegistration: updatefound lifecycle', () => {
  it('calls onUpdateAvailable when a new worker reaches installed state with a controller', async () => {
    let called = false;
    const registration = makeRegistration({ waiting: null });
    const nav = makeNav({ registration, controller: {} });

    const handle = createPwaRegistration({ nav, win: makeWin() });
    await handle.init({ onUpdateAvailable: () => { called = true; } });

    // Simulate a new SW finding an update
    const newWorker = makeWorker('installing');
    registration._fireUpdateFound(newWorker);
    newWorker.setState('installed');

    assert.equal(called, true);
  });

  it('does NOT call onUpdateAvailable when new worker reaches installed but no controller (first install)', async () => {
    let called = false;
    const registration = makeRegistration({ waiting: null });
    const nav = makeNav({ registration, controller: null });

    const handle = createPwaRegistration({ nav, win: makeWin() });
    await handle.init({ onUpdateAvailable: () => { called = true; } });

    const newWorker = makeWorker('installing');
    registration._fireUpdateFound(newWorker);
    newWorker.setState('installed');

    assert.equal(called, false);
  });

  it('does NOT call onUpdateAvailable when new worker reaches activating (not yet installed)', async () => {
    let called = false;
    const registration = makeRegistration({ waiting: null });
    const nav = makeNav({ registration, controller: {} });

    const handle = createPwaRegistration({ nav, win: makeWin() });
    await handle.init({ onUpdateAvailable: () => { called = true; } });

    const newWorker = makeWorker('installing');
    registration._fireUpdateFound(newWorker);
    newWorker.setState('activating'); // wrong state — should not trigger

    assert.equal(called, false);
  });
});

// ── applyUpdate ───────────────────────────────────────────────────────────────

describe('createPwaRegistration: applyUpdate', () => {
  it('posts SKIP_WAITING to the waiting SW', async () => {
    const messages = [];
    const waitingWorker = makeWorker('installed');
    waitingWorker.postMessage = (msg) => { messages.push(msg); };

    const registration = makeRegistration({ waiting: waitingWorker });
    const nav = makeNav({ registration, controller: {} });

    const handle = createPwaRegistration({ nav, win: makeWin() });
    await handle.init({ onUpdateAvailable: () => {} });
    handle.applyUpdate();

    assert.equal(messages.length, 1);
    assert.deepEqual(messages[0], { type: 'SKIP_WAITING' });
  });

  it('is a no-op when there is no waiting SW', async () => {
    const registration = makeRegistration({ waiting: null });
    const nav = makeNav({ registration, controller: {} });

    const handle = createPwaRegistration({ nav, win: makeWin() });
    await handle.init({ onUpdateAvailable: () => {} });

    assert.doesNotThrow(() => handle.applyUpdate());
  });
});

// ── controllerchange triggers page reload ─────────────────────────────────────

describe('createPwaRegistration: controllerchange reload', () => {
  it('reloads the page when controllerchange fires', async () => {
    const win = makeWin();
    const registration = makeRegistration();
    const nav = makeNav({ registration, controller: {} });

    const handle = createPwaRegistration({ nav, win });
    await handle.init({ onUpdateAvailable: () => {} });

    nav.serviceWorker._fireControllerChange();

    assert.equal(win.reloaded, true);
  });

  it('reloads only once even if controllerchange fires multiple times', async () => {
    let reloadCount = 0;
    const win = { location: { reload() { reloadCount++; } } };
    const registration = makeRegistration();
    const nav = makeNav({ registration, controller: {} });

    const handle = createPwaRegistration({ nav, win });
    await handle.init({ onUpdateAvailable: () => {} });

    nav.serviceWorker._fireControllerChange();
    nav.serviceWorker._fireControllerChange();
    nav.serviceWorker._fireControllerChange();

    assert.equal(reloadCount, 1);
  });
});

// ── Registration failure ──────────────────────────────────────────────────────

describe('createPwaRegistration: registration failure', () => {
  it('resolves without throwing when register rejects', async () => {
    const nav = {
      serviceWorker: {
        controller: {},
        register: async () => { throw new Error('Registration failed'); },
        addEventListener: () => {},
      },
    };

    const handle = createPwaRegistration({ nav, win: makeWin() });
    await assert.doesNotReject(() => handle.init({ onUpdateAvailable: () => {} }));
  });
});
