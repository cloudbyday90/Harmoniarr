/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const npmPackageManagerPattern = /^npm@(\d+\.\d+\.\d+)$/;

export function getPinnedNpmVersion(packageManifest) {
  const packageManager = packageManifest?.packageManager;
  const match = typeof packageManager === 'string'
    ? npmPackageManagerPattern.exec(packageManager)
    : null;

  if (!match) {
    throw new Error('packageManager must pin npm to an exact version');
  }

  return match[1];
}

export function assertInstallScriptPolicy(packageManifest) {
  if (packageManifest?.allowScripts?.fsevents !== false) {
    throw new Error('allowScripts must explicitly deny fsevents install scripts');
  }

  return true;
}

export function assertCiNpmToolchainContract(actionSource, npmVersion) {
  if (typeof actionSource !== 'string' || actionSource.trim() === '') {
    throw new Error('CI npm toolchain action source is required');
  }

  const requiredFragments = [
    'actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e',
    "node-version-file: '.nvmrc'",
    "cache: 'npm'",
    'cache-dependency-path: package-lock.json',
    `npm install --global npm@${npmVersion}`,
    'run: npm --version',
  ];

  for (const fragment of requiredFragments) {
    if (!actionSource.includes(fragment)) {
      throw new Error(`CI npm toolchain action is missing required fragment: ${fragment}`);
    }
  }

  return true;
}
