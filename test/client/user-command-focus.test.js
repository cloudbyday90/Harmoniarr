/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createUserCommandFocusTracker } from '../../src/client/lib/user-command-focus.js';

function createDocument() {
  const listeners = new Set();
  const document = {
    body: {}, activeElement: null,
    addEventListener: (_, listener) => listeners.add(listener),
    removeEventListener: (_, listener) => listeners.delete(listener),
    focus(target) { this.activeElement = target; for (const listener of listeners) listener({ target }); },
  };
  const initiator = { isConnected: true, disabled: false, focus: () => document.focus(initiator) };
  document.activeElement = initiator;
  return { document, initiator, listeners };
}

test('disabling or removing the invoker retains interaction ownership but an explicit move elsewhere revokes it', () => {
  const { document, initiator, listeners } = createDocument();
  const tracker = createUserCommandFocusTracker({ document });
  assert.equal(tracker.ownsFocus(), true);
  initiator.disabled = true;
  document.focus(document.body);
  assert.equal(tracker.ownsFocus(), true);
  initiator.isConnected = false;
  assert.equal(tracker.ownsFocus(), true);
  document.focus({ name: 'Search releases' });
  assert.equal(tracker.ownsFocus(), false);
  document.focus(document.body);
  assert.equal(tracker.ownsFocus(), false, 'later body focus must not erase a user move');
  tracker.dispose();
  assert.equal(listeners.size, 0);
});

test('a failed command restores a connected enabled invoker only while it still owns focus', () => {
  const { document, initiator } = createDocument();
  const tracker = createUserCommandFocusTracker({ document });
  document.focus(document.body);
  initiator.disabled = true;
  tracker.restoreAfterFailure();
  assert.equal(document.activeElement, document.body);
  initiator.disabled = false;
  tracker.restoreAfterFailure();
  assert.equal(document.activeElement, initiator);
  const filter = {};
  document.focus(filter);
  tracker.restoreAfterFailure();
  assert.equal(document.activeElement, filter);
  tracker.dispose();
});

test('native dialog return focus remains owned while user movement within the dialog is respected', () => {
  const { document } = createDocument();
  const opener = {};
  const tracker = createUserCommandFocusTracker({ document, returnTarget: opener });
  document.focus(opener);
  assert.equal(tracker.ownsFocus(), true);
  document.focus({ name: 'Cancel' });
  document.focus(opener);
  assert.equal(tracker.ownsFocus(), false);
  tracker.dispose();
});
