/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { lstat, realpath } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { createApiError } from '../auth.js';
import { sameScanReceiptPath, withinScanReceiptRoot } from './library-scan-receipt-policy.js';

export const staleScanReceipt = () => createApiError(409, 'library_scan_receipt_stale', 'Current scan receipt evidence could not be verified');
export function createLibraryScanReceiptFileService({ lstatFn = lstat, realpathFn = realpath } = {}) {
  async function isMissing({ target, privateRoot, scanRoot }) {
    if (!sameScanReceiptPath(privateRoot, target.privateRoot) || !withinScanReceiptRoot(target.libraryPath, privateRoot)
      || !withinScanReceiptRoot(target.libraryPath, scanRoot)) throw staleScanReceipt();
    try { await lstatFn(target.libraryPath); return false; }
    catch (error) { if (error?.code !== 'ENOENT') throw error; }
    // The nearest existing ancestor must still resolve to its expected location.
    // Missing owner directories are allowed; redirected subdirectories are not.
    let ancestor = dirname(target.libraryPath);
    while (true) {
      try {
        const actual = await realpathFn(ancestor);
        if (!sameScanReceiptPath(actual, resolve(scanRoot, relative(scanRoot, ancestor)))) throw staleScanReceipt();
        break;
      } catch (error) {
        if (error?.code !== 'ENOENT' || sameScanReceiptPath(ancestor, scanRoot)) throw error;
        ancestor = dirname(ancestor);
      }
    }
    try { await lstatFn(target.libraryPath); return false; }
    catch (error) { if (error?.code !== 'ENOENT') throw error; }
    return true;
  }
  return { isMissing };
}
