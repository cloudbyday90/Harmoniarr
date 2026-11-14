/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

function refuse(message) {
  const error = new Error(`Node baseline: ${message}`);
  error.code = 'project_node_baseline_mismatch';
  throw error;
}

function imageDefault(dockerfile, name) {
  const matches = [...dockerfile.matchAll(new RegExp(`^[ \\t]*ARG[ \\t]+${name}(?:=([^\\r\\n]*))?[ \\t]*\\r?$`, 'gmu'))];
  if (matches.length !== 1 || !matches[0][1]?.trim()) refuse(`Dockerfile must define one explicit ${name} default`);
  return matches[0][1].trim();
}

/** Canonical validation pin; package engines describe the wider supported range. */
export function validateNodeBaseline({ nvmrc, dockerfile, canonicalMediaDockerfile, packageJson, packageLock, nodeVersion }) {
  const version = nvmrc.trim();
  if (!/^24\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u.test(version)) refuse('.nvmrc must pin one stable Node 24 version');
  const range = `>=${version} <25.0.0`;
  if (packageJson.engines?.node !== range || packageJson.devEngines?.runtime?.name !== 'node'
    || packageJson.devEngines?.runtime?.version !== range) refuse('package engine floors must match .nvmrc');
  if (packageLock?.packages?.['']?.engines?.node !== range) refuse('lockfile root engine floor must match .nvmrc');
  const runtimeImage = imageDefault(dockerfile, 'RUNTIME_IMAGE');
  const alpine = /^alpine:(\d+\.\d+)(?:@sha256:[a-f0-9]{64})?$/u.exec(runtimeImage)?.[1];
  if (!alpine) refuse('runtime image must pin an Alpine minor version');
  const nodeImage = imageDefault(dockerfile, 'NODE_IMAGE');
  const prefix = `node:${version}-alpine${alpine}@sha256:`;
  if (!nodeImage.startsWith(prefix) || !/^[a-f0-9]{64}$/u.test(nodeImage.slice(prefix.length))) {
    refuse('Node image must match .nvmrc and runtime Alpine, with an immutable digest');
  }
  if (typeof canonicalMediaDockerfile !== 'string' || imageDefault(canonicalMediaDockerfile, 'NODE_IMAGE') !== nodeImage) {
    refuse('canonical media runner must use the same reviewed Node image');
  }
  if (nodeVersion !== version) refuse(`validation requires Node ${version} from .nvmrc`);
  return { version, nodeImage, runtimeImage };
}

export async function checkNodeBaseline({ rootDir = process.cwd(), nodeVersion = process.versions.node, readFileImpl = readFile } = {}) {
  const [nvmrc, dockerfile, packageSource, lockSource, canonicalMediaDockerfile] = await Promise.all([
    '.nvmrc', 'Dockerfile', 'package.json', 'package-lock.json', 'testing/docker/canonical-media.Dockerfile']
    .map(file => readFileImpl(resolve(rootDir, file), 'utf8')));
  return validateNodeBaseline({ nvmrc, dockerfile, canonicalMediaDockerfile,
    packageJson: JSON.parse(packageSource), packageLock: JSON.parse(lockSource), nodeVersion });
}
