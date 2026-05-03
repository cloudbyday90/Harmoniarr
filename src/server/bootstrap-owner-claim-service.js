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

import { timingSafeEqual } from 'node:crypto';
import { hashToken } from './security.js';
import {
  normalizeEmail,
  normalizeOptionalEmail,
  normalizeUsername,
} from './validators/auth-validator.js';

export const bootstrapOwnerClaimCodeEnvVar = 'HARMONIARR_BOOTSTRAP_OWNER_CLAIM_CODE';
export const bootstrapOwnerEmailEnvVar = 'HARMONIARR_BOOTSTRAP_OWNER_EMAIL';
export const bootstrapOwnerUsernameEnvVar = 'HARMONIARR_BOOTSTRAP_OWNER_USERNAME';

const minimumClaimCodeLength = 16;

function createBootstrapClaimApiError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function maskEmail(email) {
  if (!email) {
    return null;
  }

  const [localPart, domainPart] = email.split('@');
  if (!localPart || !domainPart) {
    return null;
  }

  const [domainLabel, ...domainRest] = domainPart.split('.');
  const maskedLocalPart = `${localPart.slice(0, 1)}***`;
  const maskedDomainLabel = `${domainLabel.slice(0, 1)}***`;

  return `${maskedLocalPart}@${maskedDomainLabel}${domainRest.length > 0 ? `.${domainRest.join('.')}` : ''}`;
}

function normalizeOptionalTrimmedString(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function resolveBootstrapOwnerClaimConfig(env = process.env) {
  const configuredUsername = normalizeOptionalTrimmedString(env[bootstrapOwnerUsernameEnvVar]);
  const configuredEmail = normalizeOptionalTrimmedString(env[bootstrapOwnerEmailEnvVar]);
  const configuredClaimCode = normalizeOptionalTrimmedString(env[bootstrapOwnerClaimCodeEnvVar]);

  if (!configuredUsername && !configuredEmail && !configuredClaimCode) {
    return {
      required: false,
      claimCode: null,
      email: null,
      username: null,
    };
  }

  if (!configuredClaimCode) {
    throw new Error(
      `${bootstrapOwnerClaimCodeEnvVar} is required when ${bootstrapOwnerUsernameEnvVar} or ${bootstrapOwnerEmailEnvVar} is configured.`,
    );
  }

  if (!configuredUsername && !configuredEmail) {
    throw new Error(
      `At least one of ${bootstrapOwnerUsernameEnvVar} or ${bootstrapOwnerEmailEnvVar} is required when ${bootstrapOwnerClaimCodeEnvVar} is configured.`,
    );
  }

  if (configuredClaimCode.length < minimumClaimCodeLength) {
    throw new Error(
      `${bootstrapOwnerClaimCodeEnvVar} must be at least ${minimumClaimCodeLength} characters long.`,
    );
  }

  return {
    required: true,
    claimCode: configuredClaimCode,
    email: configuredEmail ? normalizeEmail(configuredEmail) : null,
    username: configuredUsername ? normalizeUsername(configuredUsername) : null,
  };
}

export function createBootstrapOwnerClaimService({
  env = process.env,
  hashTokenFn = hashToken,
  normalizeEmailFn = normalizeEmail,
  normalizeOptionalEmailFn = normalizeOptionalEmail,
  normalizeUsernameFn = normalizeUsername,
} = {}) {
  const config = resolveBootstrapOwnerClaimConfig(env);
  const configuredClaimCodeHash = config.claimCode ? hashTokenFn(config.claimCode) : null;

  function isClaimRequired() {
    return config.required;
  }

  function buildBootstrapOwnerClaimStatus() {
    if (!config.required) {
      return null;
    }

    return {
      required: true,
      authMethods: ['local'],
      usernameHint: config.username,
      emailHint: maskEmail(config.email),
      emailRequired: Boolean(config.email),
      usernameRequired: true,
    };
  }

  function verifyClaimCode(claimCode) {
    if (!config.required) {
      return true;
    }

    const submittedClaimCode = normalizeOptionalTrimmedString(claimCode);
    if (!submittedClaimCode || !configuredClaimCodeHash) {
      return false;
    }

    const submittedHash = hashTokenFn(submittedClaimCode);
    const expectedBuffer = Buffer.from(configuredClaimCodeHash, 'hex');
    const submittedBuffer = Buffer.from(submittedHash, 'hex');

    if (expectedBuffer.length !== submittedBuffer.length) {
      return false;
    }

    return timingSafeEqual(expectedBuffer, submittedBuffer);
  }

  function assertLocalOwnerClaim({ claimCode, email, username }) {
    const normalizedUsername = normalizeUsernameFn(username);
    const normalizedEmail = normalizeOptionalEmailFn(email);

    if (!config.required) {
      return {
        email: normalizedEmail,
        username: normalizedUsername,
      };
    }

    if (!verifyClaimCode(claimCode)) {
      throw createBootstrapClaimApiError(403, 'bootstrap_owner_claim_invalid', 'Claim code or owner identity is incorrect');
    }

    if (config.username && normalizedUsername !== config.username) {
      throw createBootstrapClaimApiError(403, 'bootstrap_owner_claim_invalid', 'Claim code or owner identity is incorrect');
    }

    if (config.email && normalizedEmail !== normalizeEmailFn(config.email)) {
      throw createBootstrapClaimApiError(403, 'bootstrap_owner_claim_invalid', 'Claim code or owner identity is incorrect');
    }

    return {
      email: normalizedEmail,
      username: normalizedUsername,
    };
  }

  return {
    assertLocalOwnerClaim,
    buildBootstrapOwnerClaimStatus,
    isClaimRequired,
  };
}
