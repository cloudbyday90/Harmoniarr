/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';

export const nativeFileVolumeOptions = Object.freeze({
  type: 'tmpfs', device: 'tmpfs', o: 'size=4m,uid=1000,gid=1000,mode=0700,noexec,nosuid,nodev',
});

export async function acknowledgeNativeFileVolume({ provider, fixture, projectName, inspectVolume }) {
  const mounts = value => value.Mounts.filter(mount => mount.Type === 'volume');
  const writer = mounts(provider); const reader = mounts(fixture);
  assert.equal(writer.length, 1); assert.equal(reader.length, 1);
  assert.equal(writer[0].Destination, '/data/downloads'); assert.equal(writer[0].RW, true);
  assert.equal(reader[0].Destination, '/downloads'); assert.equal(reader[0].RW, false);
  const name = projectName + '_completed';
  assert.equal(writer[0].Name, name); assert.equal(reader[0].Name, name);
  const volume = await inspectVolume(name);
  assert.equal(volume.Name, name); assert.equal(volume.Driver, 'local');
  assert.equal(volume.Labels['com.docker.compose.project'], projectName);
  assert.equal(volume.Labels['com.docker.compose.volume'], 'completed');
  assert.deepEqual(volume.Options, nativeFileVolumeOptions);
  return { sharedReadOnlyInspector: true, boundedTmpfs: true, bytesLimit: 4 * 1024 * 1024 };
}
