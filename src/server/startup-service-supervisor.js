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

export function createStartupServiceSupervisor({
  processEmitter = process,
  signals = ['SIGINT', 'SIGTERM'],
} = {}) {
  const services = [];
  const signalListeners = new Map();
  let shutdownPromise = null;

  function registerService(service) {
    if (!service || typeof service.start !== 'function' || typeof service.stop !== 'function') {
      throw new Error('service must provide start() and stop() functions');
    }

    services.push(service);
    return service;
  }

  function startAll() {
    for (const service of services) {
      service.start();
    }
  }

  async function stopAll() {
    for (const service of [...services].reverse()) {
      await service.stop();
    }
  }

  function removeSignalHandlers() {
    for (const [signal, listener] of signalListeners.entries()) {
      processEmitter.off(signal, listener);
    }

    signalListeners.clear();
  }

  function installSignalHandlers(onSignal) {
    removeSignalHandlers();

    for (const signal of signals) {
      const listener = () => {
        void onSignal(signal);
      };
      signalListeners.set(signal, listener);
      processEmitter.on(signal, listener);
    }
  }

  async function shutdown({ onShutdown = async () => {} } = {}) {
    if (shutdownPromise) {
      return shutdownPromise;
    }

    shutdownPromise = (async () => {
      removeSignalHandlers();
      await stopAll();
      await onShutdown();
    })();

    return shutdownPromise;
  }

  return {
    installSignalHandlers,
    registerService,
    shutdown,
    startAll,
    stopAll,
  };
}