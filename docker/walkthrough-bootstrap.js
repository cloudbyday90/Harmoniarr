/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

const defaultBaseUrl = 'http://harmoniarr:3000';
const defaultTimeoutMs = 60_000;
const defaultPollIntervalMs = 1_000;

function getRequiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required for the Docker walkthrough bootstrap helper.`);
  }

  return value;
}

function getOptionalEnv(name) {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : null;
}

async function waitForHealthyBaseUrl(baseUrl, timeoutMs) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/healthz`);
      if (response.ok) {
        return;
      }
    } catch {
      // The app is still starting up.
    }

    await new Promise((resolve) => {
      setTimeout(resolve, defaultPollIntervalMs);
    });
  }

  throw new Error(`Timed out waiting for ${baseUrl}/healthz to become ready.`);
}

async function readBootstrapStatus(baseUrl) {
  const response = await fetch(`${baseUrl}/api/v1/bootstrap/status`);

  if (!response.ok) {
    throw new Error(`Bootstrap status check failed with HTTP ${response.status}.`);
  }

  return response.json();
}

async function createBootstrapAdmin(baseUrl, payload) {
  const response = await fetch(`${baseUrl}/api/v1/bootstrap/admin`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'user-agent': 'harmoniarr-docker-walkthrough-bootstrap/1.0',
    },
    body: JSON.stringify(payload),
  });

  const responseBody = await response.json().catch(() => null);

  if (response.status === 201) {
    return;
  }

  if (response.status === 409 && responseBody?.code === 'bootstrap_unavailable') {
    return;
  }

  throw new Error(
    `Bootstrap admin creation failed with HTTP ${response.status}${responseBody?.code ? ` (${responseBody.code})` : ''}.`,
  );
}

async function main() {
  const baseUrl = process.env.HARMONIARR_WALKTHROUGH_BASE_URL?.trim() || defaultBaseUrl;
  const timeoutMs = Number.parseInt(process.env.HARMONIARR_WALKTHROUGH_TIMEOUT_MS ?? `${defaultTimeoutMs}`, 10);
  const username = getRequiredEnv('HARMONIARR_WALKTHROUGH_USERNAME');
  const password = getRequiredEnv('HARMONIARR_WALKTHROUGH_PASSWORD');
  const email = getOptionalEnv('HARMONIARR_WALKTHROUGH_EMAIL');
  const claimCode = getOptionalEnv('HARMONIARR_WALKTHROUGH_CLAIM_CODE');

  console.log(`[harmoniarr-walkthrough-bootstrap] waiting for ${baseUrl}`);
  await waitForHealthyBaseUrl(baseUrl, timeoutMs);

  const bootstrapStatus = await readBootstrapStatus(baseUrl);
  if (!bootstrapStatus.bootstrapRequired) {
    console.log('[harmoniarr-walkthrough-bootstrap] bootstrap admin already exists');
    return;
  }

  await createBootstrapAdmin(baseUrl, {
    claimCode,
    email,
    password,
    username,
  });
  console.log(`[harmoniarr-walkthrough-bootstrap] bootstrap admin ready for ${username}`);
}

main().catch((error) => {
  console.error('[harmoniarr-walkthrough-bootstrap] failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});