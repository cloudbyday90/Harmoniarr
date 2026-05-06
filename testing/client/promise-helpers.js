/**
 * Polyfill for Promise.withResolvers() (available in Node 22+).
 *
 * Returns { promise, resolve, reject } so callers can manually settle the
 * promise, which is useful for controlling async timing in tests.
 *
 * Use this instead of calling Promise.withResolvers() directly to keep the
 * test suite compatible with Node 20.
 */
export function withResolvers() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
