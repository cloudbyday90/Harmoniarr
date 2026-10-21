/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */

const closedOutput = () => Object.assign(new Error('CLI output closed before delivery'), { code: 'ERR_STREAM_PREMATURE_CLOSE' });

/** Hand off one record without ending or destroying the borrowed output stream. */
export function writeCliRecord(stream, record) {
  return new Promise((resolve, reject) => {
    if (stream.destroyed || stream.writableEnded || stream.writable === false) {
      reject(stream.errored ?? closedOutput());
      return;
    }

    let settled = false;
    function cleanup() {
      stream.removeListener('error', onError);
      stream.removeListener('close', onClose);
    }
    function fail(error) {
      if (settled) return;
      settled = true;
      // A write callback receives its error before the stream emits 'error'.
      // Retain our listener through that emission without removing other owners.
      setImmediate(cleanup);
      reject(error);
    }
    function onError(error) { fail(error); }
    function onClose() { fail(stream.errored ?? closedOutput()); }
    stream.on('error', onError);
    stream.on('close', onClose);
    try {
      stream.write(record, error => {
        if (error) { fail(error); return; }
        if (settled) return;
        settled = true;
        cleanup();
        resolve();
      });
    } catch (error) { fail(error); }
  });
}
