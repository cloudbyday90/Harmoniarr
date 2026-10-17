/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { EventEmitter } from 'node:events';
import { IncomingMessage, Server, ServerResponse } from 'node:http';
import { types } from 'node:util';
import { createFixturePhaseScope } from '../integration/fixture-phase-observer.js';
import { bindOwnedHttpPhaseDispatch } from './owned-http-phase-dispatch.js';

/** Scope only the owned native request dispatch; never change the listener list. */
export function observeOwnedHttpRequestPhases({ server, phaseObserver }) {
  const noop = { restore() {} };
  if (!phaseObserver || types.isProxy(server) || !(server instanceof Server)) return noop;
  const active = new Set();
  const serverOwner = bindOwnedHttpPhaseDispatch(server, (run, [event, request, response]) => {
    if (event !== 'request' || types.isProxy(request) || types.isProxy(response)
      || !(request instanceof IncomingMessage) || !(response instanceof ServerResponse)) return run();
    const scope = createFixturePhaseScope(phaseObserver, 'http_request');
    if (!scope) return run();
    const owners = [];
    function retire() {
      scope.finish(); active.delete(retire);
      for (const owner of owners) owner.restore();
      for (const terminalEvent of ['finish', 'close']) {
        try { EventEmitter.prototype.removeListener.call(response, terminalEvent, retire); } catch { /* Optional cleanup cannot replace dispatch. */ }
      }
    }
    for (const emitter of [request, response]) {
      const owner = bindOwnedHttpPhaseDispatch(emitter, work => scope.run(work));
      if (!owner) { retire(); return run(); }
      owners.push(owner);
    }
    active.add(retire);
    try {
      EventEmitter.prototype.on.call(response, 'finish', retire); EventEmitter.prototype.on.call(response, 'close', retire);
    } catch { retire(); return run(); }
    try { return scope.run(run); }
    catch (error) { retire(); throw error; }
  });
  if (!serverOwner) return noop;
  return { restore() {
    for (const retire of active) retire();
    serverOwner.restore();
  } };
}
