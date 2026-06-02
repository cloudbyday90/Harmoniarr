/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { mkdir, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export const browserVisualEvidenceDirEnvVar = 'HARMONIARR_BROWSER_VISUAL_EVIDENCE_DIR';

const defaultBrowserVisualEvidenceDir = 'artifacts/browser-visual-evidence';
const minScreenshotBytes = 2048;

function sanitizeEvidenceSegment(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'visual-evidence';
}

function normalizeScreenshotName(name, index) {
  return `${String(index).padStart(2, '0')}-${sanitizeEvidenceSegment(name)}.png`;
}

function resolveEvidenceRoot({ env = process.env, rootDir = process.cwd() } = {}) {
  const configuredDir = env[browserVisualEvidenceDirEnvVar];
  return resolve(rootDir, configuredDir && configuredDir.trim() ? configuredDir.trim() : defaultBrowserVisualEvidenceDir);
}

export async function stabilizeVisualEvidencePage(page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-delay: 0s !important;
        animation-duration: 0s !important;
        caret-color: transparent !important;
        scroll-behavior: auto !important;
        transition-delay: 0s !important;
        transition-duration: 0s !important;
      }
    `,
  });
}

export function createBrowserVisualEvidenceRecorder({
  env = process.env,
  rootDir = process.cwd(),
  scenarioName,
} = {}) {
  if (!scenarioName || typeof scenarioName !== 'string') {
    throw new Error('scenarioName is required');
  }

  const evidenceDir = resolve(resolveEvidenceRoot({ env, rootDir }), sanitizeEvidenceSegment(scenarioName));
  const captures = [];

  return {
    captures,
    evidenceDir,
    async capture(page, {
      description,
      fullPage = true,
      name,
      surface,
    } = {}) {
      if (!name || typeof name !== 'string') {
        throw new Error('visual evidence capture name is required');
      }
      if (!surface || typeof surface !== 'string') {
        throw new Error('visual evidence capture surface is required');
      }

      await mkdir(evidenceDir, { recursive: true });
      const screenshotPath = resolve(evidenceDir, normalizeScreenshotName(name, captures.length + 1));
      const viewport = page.viewportSize();

      await page.screenshot({
        fullPage,
        path: screenshotPath,
      });

      const screenshotStats = await stat(screenshotPath);
      if (screenshotStats.size < minScreenshotBytes) {
        throw new Error(`Visual evidence screenshot is unexpectedly small: ${screenshotPath}`);
      }

      const capture = {
        description: description ?? null,
        fullPage,
        name,
        path: screenshotPath,
        sizeBytes: screenshotStats.size,
        surface,
        url: page.url(),
        viewport,
      };
      captures.push(capture);
      return capture;
    },
    async writeManifest() {
      await mkdir(evidenceDir, { recursive: true });
      const manifestPath = resolve(evidenceDir, 'manifest.json');
      const manifest = {
        captureCount: captures.length,
        captures,
        generatedAt: new Date().toISOString(),
        scenarioName,
      };
      await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

      return {
        captureCount: captures.length,
        manifestPath,
      };
    },
  };
}
