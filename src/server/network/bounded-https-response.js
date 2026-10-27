/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { Transform, Writable, pipeline } from 'node:stream';
import { createGunzip, createInflate, createBrotliDecompress, constants } from 'node:zlib';

/** Own encoded input, decoded output and codec close. Input caps are not heap caps. */
export function startBoundedHttpsResponse(incoming, { maxBytes, check, signal, createError: createFailure, compression = false, readErrors = false, validateHeaders }) {
  const failures = new WeakSet(), createError = reason => { const error = createFailure(reason); failures.add(error); return error; };
  const status = incoming.statusCode, headers = new Headers(incoming.headers);
  validateHeaders?.(status, headers, maxBytes);
  if (!Number.isInteger(status) || status < 100 || status > 599) throw createError('invalid');
  if (status >= 300 && status < 400) throw createError('redirect');
  if (!readErrors && (status < 200 || status >= 300)) return { result: Promise.resolve({ status, headers, body: Buffer.alloc(0) }), drained: Promise.resolve(true), cancel() {} };
  const limit = status >= 400 ? Math.min(maxBytes, 4096) : maxBytes;
  const encoding = headers.get('content-encoding')?.trim().toLowerCase() ?? 'identity';
  const length = headers.get('content-length');
  if (length !== null && (!/^\d+$/u.test(length) || !Number.isSafeInteger(Number(length)) || Number(length) > limit)) throw createError('oversized');
  const options = { chunkSize: 16_384, rejectGarbageAfterEnd: true };
  let codec;
  if (!encoding || encoding === 'identity') codec = null;
  else if (!compression) throw createError('invalid');
  else if (encoding === 'gzip') codec = createGunzip(options);
  else if (encoding === 'deflate') codec = createInflate(options);
  else if (encoding === 'br') codec = createBrotliDecompress({ chunkSize: 16_384, rejectGarbageAfterEnd: true, params: { [constants.BROTLI_DECODER_PARAM_LARGE_WINDOW]: 0 } });
  else throw createError('invalid');
  const completion = Promise.withResolvers(), closes = [], streams = [], chunks = [];
  let encoded = 0, decoded = 0;
  function own(stream) {
    const closed = Promise.withResolvers(); stream.once('close', closed.resolve); closes.push(closed.promise); streams.push(stream); return stream;
  }
  if (codec) own(codec);
  const counter = own(new Transform({ transform(chunk, _encoding, callback) {
    try { check(); encoded += chunk.byteLength; if (encoded > limit) throw createError('oversized'); callback(null, chunk); } catch (error) { callback(error); }
  } }));
  const sink = own(new Writable({ write(chunk, _encoding, callback) {
    try { check(); decoded += chunk.byteLength; if (decoded > limit) throw createError('oversized'); chunks.push(chunk); callback(); } catch (error) { callback(error); }
  } }));
  const cancel = () => { for (const stream of streams) stream.destroy(); };
  try {
    pipeline([incoming, counter, ...(codec ? [codec] : []), sink], error => {
      if (error) { completion.reject(signal?.aborted ? createError('timeout') : failures.has(error) ? error : createError('invalid')); return; }
      try { check(); if (!incoming.complete) throw createError('invalid'); completion.resolve({ status, headers, body: Buffer.concat(chunks, decoded) }); }
      catch (failure) { completion.reject(failure); }
    });
  } catch (error) { cancel(); completion.reject(error); }
  return { result: completion.promise, drained: completion.promise.then(() => {}, () => {}).then(async () => { await Promise.all(closes); return true; }), cancel };
}
