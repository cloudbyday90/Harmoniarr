/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { EventEmitter } from 'node:events';
import { types } from 'node:util';

/** Refuse custom/accessor dispatch without invoking it during capability checks. */
export function bindOwnedHttpPhaseDispatch(emitter, dispatch) {
  let descriptor;
  try {
    let prototype = emitter; let supported = false;
    for (let depth = 0; prototype && depth < 12; depth++) {
      if (types.isProxy(prototype)) return null;
      const candidate = Object.getOwnPropertyDescriptor(prototype, 'emit');
      if (depth === 0) descriptor = candidate;
      if (candidate) { supported = Object.hasOwn(candidate, 'value') && candidate.value === EventEmitter.prototype.emit; break; }
      prototype = Object.getPrototypeOf(prototype);
    }
    if (!supported) return null;
  } catch { return null; }
  const emit = EventEmitter.prototype.emit; let retired = false;
  function ownedEmit(...args) {
    const run = () => Reflect.apply(emit, this, args);
    return retired || this !== emitter ? run() : dispatch(run, args);
  }
  try {
    Object.defineProperty(emitter, 'emit', { value: ownedEmit, configurable: true, writable: true,
      enumerable: descriptor?.enumerable ?? false });
  } catch { return null; }
  return { restore() {
    retired = true;
    try {
      if (Object.getOwnPropertyDescriptor(emitter, 'emit')?.value !== ownedEmit) return;
      if (descriptor) Object.defineProperty(emitter, 'emit', descriptor); else delete emitter.emit;
    } catch { /* An inert adapter cannot replace the original fixture failure. */ }
  } };
}
