/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
const property = '--hx-settings-save-bar-height';
const reservations = new WeakMap();

function reserve(host) {
  let record = reservations.get(host);
  if (!record) {
    record = { value: host.style.getPropertyValue(property), priority: host.style.getPropertyPriority(property), slots: new Map(), last: null };
    reservations.set(host, record);
  }
  const key = Symbol(); record.slots.set(key, 0);
  const owned = () => host.style.getPropertyValue(property) === record.last && host.style.getPropertyPriority(property) === '';
  function publish() {
    if (record.last !== null && !owned()) return;
    record.last = `${Math.max(0, ...record.slots.values())}px`;
    host.style.setProperty(property, record.last);
  }
  return {
    set(height) { record.slots.set(key, height); publish(); },
    dispose() {
      record.slots.delete(key);
      if (record.slots.size) { publish(); return; }
      reservations.delete(host);
      if (!owned()) return;
      if (record.value) host.style.setProperty(property, record.value, record.priority);
      else host.style.removeProperty(property);
    },
  };
}

export function observeStickySaveBar(bar, { ResizeObserverCtor = globalThis.ResizeObserver,
  windowTarget = globalThis.window, getStyle = globalThis.getComputedStyle } = {}) {
  const host = bar?.closest('.hx-main');
  if (!host) return { refresh() {}, dispose() {} };
  const reservation = reserve(host), previousOverflow = bar.getAttribute('data-sticky-overflow');
  let disposed = false, overflow;
  function refresh() {
    if (disposed) return;
    const height = Math.ceil(bar.getBoundingClientRect().height);
    if (!Number.isFinite(height) || height < 0) return;
    overflow = height * 2 > host.clientHeight ? '' : null;
    if (overflow === null) bar.removeAttribute('data-sticky-overflow');
    else bar.setAttribute('data-sticky-overflow', overflow);
    reservation.set(getStyle(bar).position === 'sticky' ? height : 0);
  }
  let observer;
  function dispose() {
    if (disposed) return;
    disposed = true;
    try { observer?.disconnect(); }
    finally {
      try { windowTarget?.removeEventListener('resize', refresh); }
      finally { reservation.dispose(); }
      if (bar.getAttribute('data-sticky-overflow') === overflow) {
        if (previousOverflow === null) bar.removeAttribute('data-sticky-overflow');
        else bar.setAttribute('data-sticky-overflow', previousOverflow);
      }
    }
  }
  try {
    observer = ResizeObserverCtor ? new ResizeObserverCtor(refresh) : null;
    observer?.observe(bar, { box: 'border-box' }); observer?.observe(host, { box: 'border-box' });
    windowTarget?.addEventListener('resize', refresh); refresh();
  } catch (error) {
    try { dispose(); } catch { /* Preserve the setup failure after attempting retirement. */ }
    throw error;
  }
  return { refresh, dispose };
}
