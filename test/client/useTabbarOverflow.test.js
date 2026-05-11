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
import { useTabbarOverflow } from '../../src/client/composables/useTabbarOverflow.js';

// ── helpers ───────────────────────────────────────────────────────────────────

/**
 * Create a minimal fake scrollable element with controllable scroll geometry
 * and a simple scroll-event bus.
 */
function makeFakeElement({ scrollLeft = 0, scrollWidth = 0, clientWidth = 0 } = {}) {
  let _scrollHandler = null;
  const el = {
    scrollLeft,
    scrollWidth,
    clientWidth,
    addEventListener(_type, fn) { _scrollHandler = fn; },
    removeEventListener(_type, fn) { if (_scrollHandler === fn) _scrollHandler = null; },
    get _hasScrollListener() { return _scrollHandler !== null; },
    _fireScroll() { if (_scrollHandler) _scrollHandler(); },
  };
  return el;
}

/**
 * Create a minimal fake ResizeObserver that records observe/disconnect calls.
 */
function makeFakeResizeObserver() {
  let _callback = null;
  let _observing = false;
  let _disconnected = false;

  class FakeResizeObserver {
    constructor(callback) { _callback = callback; }
    observe() { _observing = true; }
    disconnect() { _disconnected = true; _observing = false; }
  }

  return {
    Ctor: FakeResizeObserver,
    get observing() { return _observing; },
    get disconnected() { return _disconnected; },
    fire() { if (_callback) _callback(); },
  };
}

/**
 * Build injectable helpers that capture calls.
 */
function makeInjectables(el, ro = null) {
  return {
    addScrollListenerFn: (target, fn) => target.addEventListener('scroll', fn, { passive: true }),
    removeScrollListenerFn: (target, fn) => target.removeEventListener('scroll', fn),
    ResizeObserverCtor: ro ? ro.Ctor : null,
  };
}

// ── initial state before attach ───────────────────────────────────────────────

test('useTabbarOverflow: hasOverflowStart is false before attach', () => {
  const { hasOverflowStart } = useTabbarOverflow({ ResizeObserverCtor: null });
  assert.equal(hasOverflowStart.value, false);
});

test('useTabbarOverflow: hasOverflowEnd is false before attach', () => {
  const { hasOverflowEnd } = useTabbarOverflow({ ResizeObserverCtor: null });
  assert.equal(hasOverflowEnd.value, false);
});

// ── attach: initial read of element geometry ──────────────────────────────────

test('useTabbarOverflow: attach reads initial element state — no overflow', () => {
  const el = makeFakeElement({ scrollLeft: 0, scrollWidth: 400, clientWidth: 400 });
  const inj = makeInjectables(el);
  const { hasOverflowStart, hasOverflowEnd, attach } = useTabbarOverflow(inj);

  attach(el);

  assert.equal(hasOverflowStart.value, false);
  assert.equal(hasOverflowEnd.value, false);
});

test('useTabbarOverflow: attach reads initial state — overflow on right only', () => {
  const el = makeFakeElement({ scrollLeft: 0, scrollWidth: 800, clientWidth: 400 });
  const inj = makeInjectables(el);
  const { hasOverflowStart, hasOverflowEnd, attach } = useTabbarOverflow(inj);

  attach(el);

  assert.equal(hasOverflowStart.value, false);
  assert.equal(hasOverflowEnd.value, true);
});

test('useTabbarOverflow: attach reads initial state — scrolled to middle', () => {
  const el = makeFakeElement({ scrollLeft: 200, scrollWidth: 800, clientWidth: 400 });
  const inj = makeInjectables(el);
  const { hasOverflowStart, hasOverflowEnd, attach } = useTabbarOverflow(inj);

  attach(el);

  assert.equal(hasOverflowStart.value, true);
  assert.equal(hasOverflowEnd.value, true);
});

test('useTabbarOverflow: attach reads initial state — scrolled to end', () => {
  const el = makeFakeElement({ scrollLeft: 400, scrollWidth: 800, clientWidth: 400 });
  const inj = makeInjectables(el);
  const { hasOverflowStart, hasOverflowEnd, attach } = useTabbarOverflow(inj);

  attach(el);

  assert.equal(hasOverflowStart.value, true);
  assert.equal(hasOverflowEnd.value, false);
});

// ── 1-pixel rounding tolerance ────────────────────────────────────────────────

test('useTabbarOverflow: hasOverflowEnd is false within 0.5px tolerance at end', () => {
  // scrollLeft + clientWidth = 399.5, scrollWidth = 400 → diff = 0.5 ≤ 0.5 tolerance → no fade
  const el = makeFakeElement({ scrollLeft: 0, scrollWidth: 400, clientWidth: 400 });
  // Simulate float rounding: clientWidth fractional due to DPR
  el.scrollWidth = 400;
  el.clientWidth = 399.5;
  el.scrollLeft = 0;

  const inj = makeInjectables(el);
  const { hasOverflowEnd, attach } = useTabbarOverflow(inj);
  attach(el);

  assert.equal(hasOverflowEnd.value, false);
});

test('useTabbarOverflow: hasOverflowEnd is true when diff is exactly 1px', () => {
  // scrollLeft=0, clientWidth=399, scrollWidth=400 → diff=1 which is NOT < 1
  const el = makeFakeElement({ scrollLeft: 0, scrollWidth: 400, clientWidth: 399 });
  const inj = makeInjectables(el);
  const { hasOverflowEnd, attach } = useTabbarOverflow(inj);
  attach(el);

  assert.equal(hasOverflowEnd.value, true);
});

// ── scroll event updates state ────────────────────────────────────────────────

test('useTabbarOverflow: scroll event updates hasOverflowStart to true', () => {
  const el = makeFakeElement({ scrollLeft: 0, scrollWidth: 800, clientWidth: 400 });
  const inj = makeInjectables(el);
  const { hasOverflowStart, attach } = useTabbarOverflow(inj);

  attach(el);
  assert.equal(hasOverflowStart.value, false);

  // Simulate user scrolling right
  el.scrollLeft = 100;
  el._fireScroll();

  assert.equal(hasOverflowStart.value, true);
});

test('useTabbarOverflow: scroll event updates hasOverflowEnd to false at end', () => {
  const el = makeFakeElement({ scrollLeft: 0, scrollWidth: 800, clientWidth: 400 });
  const inj = makeInjectables(el);
  const { hasOverflowEnd, attach } = useTabbarOverflow(inj);

  attach(el);
  assert.equal(hasOverflowEnd.value, true);

  // Simulate user scrolling to the very end
  el.scrollLeft = 400;
  el._fireScroll();

  assert.equal(hasOverflowEnd.value, false);
});

test('useTabbarOverflow: multiple scroll events update state correctly', () => {
  const el = makeFakeElement({ scrollLeft: 0, scrollWidth: 900, clientWidth: 300 });
  const inj = makeInjectables(el);
  const { hasOverflowStart, hasOverflowEnd, attach } = useTabbarOverflow(inj);

  attach(el);
  // Start: at left edge, right overflow exists
  assert.equal(hasOverflowStart.value, false);
  assert.equal(hasOverflowEnd.value, true);

  // Middle
  el.scrollLeft = 300;
  el._fireScroll();
  assert.equal(hasOverflowStart.value, true);
  assert.equal(hasOverflowEnd.value, true);

  // At right end
  el.scrollLeft = 600;
  el._fireScroll();
  assert.equal(hasOverflowStart.value, true);
  assert.equal(hasOverflowEnd.value, false);
});

// ── scroll listener attachment ────────────────────────────────────────────────

test('useTabbarOverflow: attach registers a scroll listener on the element', () => {
  const el = makeFakeElement({ scrollLeft: 0, scrollWidth: 400, clientWidth: 400 });
  const inj = makeInjectables(el);
  const { attach } = useTabbarOverflow(inj);

  assert.equal(el._hasScrollListener, false);
  attach(el);
  assert.equal(el._hasScrollListener, true);
});

test('useTabbarOverflow: attach(null) is a safe no-op', () => {
  const { attach, hasOverflowStart, hasOverflowEnd } = useTabbarOverflow({
    ResizeObserverCtor: null,
  });

  assert.doesNotThrow(() => attach(null));
  assert.equal(hasOverflowStart.value, false);
  assert.equal(hasOverflowEnd.value, false);
});

// ── ResizeObserver wiring ─────────────────────────────────────────────────────

test('useTabbarOverflow: attach creates and connects a ResizeObserver', () => {
  const el = makeFakeElement({ scrollLeft: 0, scrollWidth: 400, clientWidth: 400 });
  const ro = makeFakeResizeObserver();
  const inj = makeInjectables(el, ro);
  const { attach } = useTabbarOverflow(inj);

  attach(el);

  assert.equal(ro.observing, true);
});

test('useTabbarOverflow: ResizeObserver callback updates state on resize', () => {
  const el = makeFakeElement({ scrollLeft: 0, scrollWidth: 400, clientWidth: 400 });
  const ro = makeFakeResizeObserver();
  const inj = makeInjectables(el, ro);
  const { hasOverflowEnd, attach } = useTabbarOverflow(inj);

  attach(el);
  assert.equal(hasOverflowEnd.value, false);

  // Simulate viewport shrink that causes overflow
  el.scrollWidth = 800;
  ro.fire();

  assert.equal(hasOverflowEnd.value, true);
});

test('useTabbarOverflow: works without ResizeObserver (null Ctor)', () => {
  const el = makeFakeElement({ scrollLeft: 0, scrollWidth: 800, clientWidth: 400 });
  const inj = {
    addScrollListenerFn: (target, fn) => target.addEventListener('scroll', fn),
    removeScrollListenerFn: (target, fn) => target.removeEventListener('scroll', fn),
    ResizeObserverCtor: null,
  };
  const { hasOverflowEnd, attach } = useTabbarOverflow(inj);

  attach(el);

  assert.equal(hasOverflowEnd.value, true);
});

// ── cleanup ───────────────────────────────────────────────────────────────────

test('useTabbarOverflow: cleanup removes scroll listener', () => {
  const el = makeFakeElement({ scrollLeft: 0, scrollWidth: 400, clientWidth: 400 });
  const inj = makeInjectables(el);
  const { attach, cleanup } = useTabbarOverflow(inj);

  attach(el);
  assert.equal(el._hasScrollListener, true);

  cleanup();
  assert.equal(el._hasScrollListener, false);
});

test('useTabbarOverflow: cleanup disconnects ResizeObserver', () => {
  const el = makeFakeElement({ scrollLeft: 0, scrollWidth: 400, clientWidth: 400 });
  const ro = makeFakeResizeObserver();
  const inj = makeInjectables(el, ro);
  const { attach, cleanup } = useTabbarOverflow(inj);

  attach(el);
  assert.equal(ro.disconnected, false);

  cleanup();
  assert.equal(ro.disconnected, true);
});

test('useTabbarOverflow: cleanup prevents scroll listener from updating state', () => {
  const el = makeFakeElement({ scrollLeft: 0, scrollWidth: 800, clientWidth: 400 });
  const inj = makeInjectables(el);
  const { hasOverflowStart, attach, cleanup } = useTabbarOverflow(inj);

  attach(el);
  cleanup();

  // After cleanup, firing a scroll must not update state
  el.scrollLeft = 200;
  el._fireScroll();

  assert.equal(hasOverflowStart.value, false);
});

test('useTabbarOverflow: cleanup is safe to call before attach', () => {
  const { cleanup } = useTabbarOverflow({ ResizeObserverCtor: null });
  assert.doesNotThrow(() => cleanup());
});

test('useTabbarOverflow: cleanup is idempotent — calling twice does not throw', () => {
  const el = makeFakeElement({ scrollLeft: 0, scrollWidth: 400, clientWidth: 400 });
  const inj = makeInjectables(el);
  const { attach, cleanup } = useTabbarOverflow(inj);

  attach(el);
  assert.doesNotThrow(() => {
    cleanup();
    cleanup();
  });
});
