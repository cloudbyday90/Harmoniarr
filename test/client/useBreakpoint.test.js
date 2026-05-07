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
import test from 'node:test';
import { useBreakpoint } from '../../src/client/composables/useBreakpoint.js';

// ── helpers ───────────────────────────────────────────────────────────────────

function makeMq({ matches = false } = {}) {
  let stored;
  return {
    matches,
    addEventListener(_type, fn) { stored = fn; },
    removeEventListener(_type, fn) {
      if (stored === fn) stored = undefined;
    },
    _fire(nextMatches) {
      if (stored) stored({ matches: nextMatches });
    },
    get _hasListener() { return stored !== undefined; },
  };
}

// ── initial state ─────────────────────────────────────────────────────────────

test('useBreakpoint: matches is false when query does not match at init', () => {
  const mq = makeMq({ matches: false });
  const { matches } = useBreakpoint({ matchMediaFn: () => mq });

  assert.equal(matches.value, false);
});

test('useBreakpoint: matches is true when query matches at init', () => {
  const mq = makeMq({ matches: true });
  const { matches } = useBreakpoint({ matchMediaFn: () => mq });

  assert.equal(matches.value, true);
});

// ── change event ──────────────────────────────────────────────────────────────

test('useBreakpoint: updates matches when change event fires true', () => {
  const mq = makeMq({ matches: false });
  const { matches } = useBreakpoint({ matchMediaFn: () => mq });

  assert.equal(matches.value, false);
  mq._fire(true);
  assert.equal(matches.value, true);
});

test('useBreakpoint: updates matches when change event fires false', () => {
  const mq = makeMq({ matches: true });
  const { matches } = useBreakpoint({ matchMediaFn: () => mq });

  assert.equal(matches.value, true);
  mq._fire(false);
  assert.equal(matches.value, false);
});

test('useBreakpoint: handles multiple change events in sequence', () => {
  const mq = makeMq({ matches: false });
  const { matches } = useBreakpoint({ matchMediaFn: () => mq });

  mq._fire(true);
  mq._fire(false);
  mq._fire(true);

  assert.equal(matches.value, true);
});

// ── cleanup ───────────────────────────────────────────────────────────────────

test('useBreakpoint: cleanup removes the change listener', () => {
  const mq = makeMq({ matches: false });
  const { matches, cleanup } = useBreakpoint({ matchMediaFn: () => mq });

  assert.equal(mq._hasListener, true);
  cleanup();
  assert.equal(mq._hasListener, false);

  // After cleanup, firing a change event must not update matches.
  mq._fire(true);
  assert.equal(matches.value, false);
});

test('useBreakpoint: cleanup is idempotent — calling twice does not throw', () => {
  const mq = makeMq({ matches: false });
  const { cleanup } = useBreakpoint({ matchMediaFn: () => mq });

  assert.doesNotThrow(() => {
    cleanup();
    cleanup();
  });
});

// ── query forwarding ─────────────────────────────────────────────────────────

test('useBreakpoint: passes the query string to matchMediaFn', () => {
  let captured;
  const mq = makeMq();
  useBreakpoint({
    query: '(max-width: 1024px)',
    matchMediaFn: (q) => { captured = q; return mq; },
  });

  assert.equal(captured, '(max-width: 1024px)');
});

test('useBreakpoint: uses default query when none provided', () => {
  let captured;
  const mq = makeMq();
  useBreakpoint({ matchMediaFn: (q) => { captured = q; return mq; } });

  assert.equal(captured, '(max-width: 640px)');
});

// ── graceful degradation ─────────────────────────────────────────────────────

test('useBreakpoint: returns false matches when matchMediaFn is null and window is absent', () => {
  // matchMediaFn: null; no window in Node.js test environment.
  const { matches } = useBreakpoint({ matchMediaFn: null });

  assert.equal(matches.value, false);
});

test('useBreakpoint: returns safe no-op cleanup when matchMediaFn is null', () => {
  const { cleanup } = useBreakpoint({ matchMediaFn: null });

  assert.doesNotThrow(() => cleanup());
});

test('useBreakpoint: cleanup is a no-op that does not update matches', () => {
  const { matches, cleanup } = useBreakpoint({ matchMediaFn: null });
  cleanup();
  assert.equal(matches.value, false);
});
