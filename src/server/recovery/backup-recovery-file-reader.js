/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
export const backupRecoveryFileLimitError = () => Object.assign(new Error('Automatic backup recovery file limit reached'), { code: 'backup_recovery_file_limit' });
/** Read only through the inspected owned handle; detect growth before unbounded allocation. */
export async function readBackupRecoveryHandle(handle, maxBytes) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new TypeError('Invalid automatic recovery byte limit');
  const size = Number((await handle.stat()).size);
  if (!Number.isSafeInteger(size) || size < 0 || size > maxBytes) throw backupRecoveryFileLimitError();
  const scratch = Buffer.allocUnsafe(Math.min(65_536, maxBytes + 1)), chunks = []; let total = 0;
  for (;;) {
    const length = Math.min(scratch.length, maxBytes - total + 1);
    const { bytesRead } = await handle.read(scratch, 0, length, null);
    if (!Number.isInteger(bytesRead) || bytesRead < 0 || bytesRead > length) throw new Error('Invalid backup recovery read');
    if (bytesRead === 0) break;
    total += bytesRead; if (total > maxBytes) throw backupRecoveryFileLimitError();
    chunks.push(Buffer.from(scratch.subarray(0, bytesRead)));
  }
  return Buffer.concat(chunks, total);
}
