/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { Socket } from 'node:net';
import { TLSSocket } from 'node:tls';
import { types } from 'node:util';
import PgConnection from 'pg/lib/connection.js';
import { capturePostgresDiagnosticErrors } from './pool-checkout-record.js';
import { buildPgStartupWriteRecord } from './pg-startup-write-record.js';

export function supportsPgStartupWriteStream(stream) {
  try {
    return !types.isProxy(stream) && [Socket.prototype, TLSSocket.prototype].includes(Object.getPrototypeOf(stream))
      && ['write', '_write', '_writev'].every(key => {
        const descriptor = Object.getOwnPropertyDescriptor(stream, key);
        return descriptor ? Object.hasOwn(descriptor, 'value') && descriptor.value === Socket.prototype[key]
          : stream[key] === Socket.prototype[key];
      });
  } catch { return false; }
}

function supportsPacket(args) {
  try {
    const packet = args[0];
    if (args.length !== 1 || !packet || types.isProxy(packet) || Object.getPrototypeOf(packet) !== Object.prototype) return false;
    const fields = Object.values(Object.getOwnPropertyDescriptors(packet));
    return fields.length <= 16 && fields.every(field => Object.hasOwn(field, 'value') && typeof field.value === 'string');
  } catch { return false; }
}

/** Only the version-reviewed native startup call may enter this instance scope. */
export function observeOwnedPgStartupWrite({ connection, now, supportsStream = supportsPgStartupWriteStream }) {
  const data = {}; let finished = false; let admitted = false;
  function clock() { try { const value = now(); return Number.isFinite(value) ? value : null; } catch { return null; } }
  function failure(error) {
    const captured = capturePostgresDiagnosticErrors(error)[0];
    data.errorCode = captured.code; data.errorClass = captured.errorClass;
  }
  return {
    dispatch(startup, receiver, args) {
      if (finished || admitted || receiver !== connection) return Reflect.apply(startup, receiver, args);
      admitted = true;
      if (startup !== PgConnection.prototype.startup) {
        data.observation = 'unsupported_method'; return Reflect.apply(startup, receiver, args);
      }
      if (!supportsPacket(args)) {
        data.observation = 'unsupported_packet'; return Reflect.apply(startup, receiver, args);
      }
      const streamDescriptor = Object.getOwnPropertyDescriptor(connection, 'stream');
      const stream = streamDescriptor && Object.hasOwn(streamDescriptor, 'value') ? streamDescriptor.value : null;
      let supported = false;
      try { supported = supportsStream(stream) === true; } catch { /* An unavailable adapter cannot replace startup. */ }
      if (!supported) {
        data.observation = 'unsupported_stream'; return Reflect.apply(startup, receiver, args);
      }
      const descriptor = Object.getOwnPropertyDescriptor(stream, 'write'); const write = stream.write;
      let called = false;
      function observedWrite(...values) {
        if (this !== stream || called || values.length !== 1 || !Buffer.isBuffer(values[0])) return Reflect.apply(write, this, values);
        called = true; data.observation = 'observed'; data.attemptedMs = clock(); data.callbackOutcome = 'pending';
        const callback = error => {
          if (finished || data.callbackOutcome !== 'pending') return;
          try {
            data.callbackMs = clock(); data.callbackOutcome = error == null ? 'passed' : 'failed';
            if (error != null) failure(error);
          } catch { data.observation = 'adapter_unavailable'; }
        };
        try {
          const result = Reflect.apply(write, this, [values[0], callback]);
          data.returnOutcome = 'returned'; data.returnedMs = clock();
          data.backpressure = result === false ? true : result === true ? false : null;
          return result;
        } catch (error) { data.returnOutcome = 'threw'; failure(error); throw error; }
      }
      try {
        Object.defineProperty(stream, 'write', { value: observedWrite, writable: true, configurable: true,
          enumerable: descriptor?.enumerable ?? false });
      } catch { data.observation = 'adapter_unavailable'; return Reflect.apply(startup, receiver, args); }
      try { return Reflect.apply(startup, receiver, args); }
      finally {
        try {
          if (stream.write !== observedWrite) data.observation = 'adapter_unavailable';
          else if (descriptor) Object.defineProperty(stream, 'write', descriptor); else delete stream.write;
        } catch { data.observation = 'adapter_unavailable'; }
      }
    },
    snapshot: () => buildPgStartupWriteRecord(data),
    finish: () => { finished = true; },
  };
}
