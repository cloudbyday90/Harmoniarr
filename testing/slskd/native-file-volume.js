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

export async function acknowledgeNativeFileVolume({ provider, fixture, projectName, inspectVolume, mode = 'files' }) {
  const mounts = value => value.Mounts.filter(mount => mount.Type === 'volume');
  const writer = mounts(provider); const reader = mounts(fixture);
  const specs = [{ key: 'completed', writer: '/data/downloads', reader: '/downloads' },
    ...(['partial', 'resume'].includes(mode) ? [{ key: 'incomplete', writer: '/data/incomplete', reader: '/incomplete' }] : [])];
  assert.equal(writer.length, specs.length); assert.equal(reader.length, specs.length);
  for (const spec of specs) {
    const write = writer.find(mount => mount.Destination === spec.writer);
    const read = reader.find(mount => mount.Destination === spec.reader);
    assert.equal(write?.RW, true); assert.equal(read?.RW, false);
    const name = projectName + '_' + spec.key;
    assert.equal(write.Name, name); assert.equal(read.Name, name);
    const volume = await inspectVolume(name);
    assert.equal(volume.Name, name); assert.equal(volume.Driver, 'local');
    assert.equal(volume.Labels['com.docker.compose.project'], projectName);
    assert.equal(volume.Labels['com.docker.compose.volume'], spec.key);
    assert.deepEqual(volume.Options, nativeFileVolumeOptions);
  }
  return { sharedReadOnlyInspector: true, boundedTmpfs: true, bytesLimit: 4 * 1024 * 1024,
    ...(['partial', 'resume'].includes(mode) ? { incompleteReadOnlyInspector: true, incompleteBytesLimit: 4 * 1024 * 1024 } : {}) };
}
