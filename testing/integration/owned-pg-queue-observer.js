/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { types } from 'node:util';
import { buildPgAcquisitionRecord } from './pg-acquisition-record.js';
import { supportsPgQueueObserver } from './pg-observer-driver.js';

/** Map actual native PendingItems; release-time async context is not ownership. */
export function observeOwnedPgQueue({ pool, now, runUnobserved }) {
  const available = supportsPgQueueObserver(pool);
  const pendingOwners = new WeakMap(); const active = new Set(); let dispatch = null;
  const methods = ['newClient', '_acquireClient'];
  const originals = available ? methods.map(key => [key, pool[key], Object.getOwnPropertyDescriptor(pool, key)]) : [];
  function clock() { try { const value = now(); return Number.isFinite(value) ? value : null; } catch { return null; } }
  function queue() {
    try {
      const value = pool._pendingQueue;
      if (types.isProxy(value) || !Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype
        || value.length > 128) return null;
      const snapshot = [];
      for (let index = 0; index < value.length; index++) {
        const descriptor = Object.getOwnPropertyDescriptor(value, index);
        if (!descriptor || !Object.hasOwn(descriptor, 'value')) return null;
        snapshot.push(descriptor.value);
      }
      return snapshot;
    } catch { return null; }
  }
  function newClient(item, ...args) {
    if (this !== pool) return Reflect.apply(originals[0][1], this, [item, ...args]);
    let owner = pendingOwners.get(item);
    // Native connect's first synchronous newClient is its own fresh PendingItem.
    // Consume this admission before invoking driver/user hooks, including reentry.
    if (!owner && dispatch && !dispatch.used) { owner = dispatch.owner; dispatch.used = true; owner.bind(item); }
    owner?.creating();
    return owner ? owner.connection.dispatch(() => Reflect.apply(originals[0][1], this, [item, ...args]))
      : runUnobserved(() => Reflect.apply(originals[0][1], this, [item, ...args]));
  }
  function acquire(client, item, listener, isNew) {
    if (this === pool) pendingOwners.get(item)?.acquiring(isNew);
    return Reflect.apply(originals[1][1], this, [client, item, listener, isNew]);
  }
  if (available) for (const [index, [key, , descriptor]] of originals.entries()) {
    Object.defineProperty(pool, key, { value: [newClient, acquire][index], writable: true, configurable: true,
      enumerable: descriptor?.enumerable ?? false });
  }
  return {
    begin(connection) {
      const start = clock(); const data = { observation: available ? 'observed' : 'unsupported_driver' };
      let item = null; let finished = false;
      const mark = (stage, field) => {
        if (finished || Object.hasOwn(data, field)) return;
        data.lastStage = stage; const end = clock(); data[field] = start !== null && end !== null ? end - start : null;
      };
      const owner = {
        connection,
        bind(value) { if (!finished) { item = value; pendingOwners.set(value, owner); } },
        creating() { data.clientKind = 'new'; mark('creating_client', 'newClientMs'); },
        acquiring(isNew) { data.clientKind = isNew === true ? 'new' : 'reused'; mark('acquire_entered', 'acquireEnteredMs'); },
      };
      const finish = () => { finished = true; if (item) pendingOwners.delete(item); item = null; active.delete(finish); };
      if (available) active.add(finish);
      return {
        dispatch(run) {
          if (!available) return runUnobserved(run);
          const previous = dispatch; const frame = { owner, used: false }; dispatch = frame;
          const before = queue();
          try { return run(); } finally {
            dispatch = previous;
            // connect only appends one item synchronously; anything else is unknown.
            const after = queue();
            if (!finished && !frame.used && before && after?.length === before.length + 1
              && before.every((value, index) => after[index] === value)
              && after.at(-1) !== null && typeof after.at(-1) === 'object' && !types.isProxy(after.at(-1))) {
              owner.bind(after.at(-1)); mark('queued', 'queuedMs');
            } else if (!finished && !frame.used) {
              data.observation = 'adapter_unavailable';
            }
          }
        },
        delivered: () => mark('delivered', 'deliveredMs'),
        snapshot: () => buildPgAcquisitionRecord(data),
        finish,
      };
    },
    restore() {
      for (const finish of active) finish();
      let changed = false;
      for (const [index, [key, , descriptor]] of originals.entries()) {
        if (pool[key] !== [newClient, acquire][index]) { changed = true; continue; }
        if (descriptor) Object.defineProperty(pool, key, descriptor); else delete pool[key];
      }
      if (changed) throw new Error('Fixture queue observer ownership changed');
    },
  };
}
