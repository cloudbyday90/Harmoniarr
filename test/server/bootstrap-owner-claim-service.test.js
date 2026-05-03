import assert from 'node:assert/strict';
import test from 'node:test';
import {
  bootstrapOwnerClaimCodeEnvVar,
  bootstrapOwnerEmailEnvVar,
  bootstrapOwnerUsernameEnvVar,
  createBootstrapOwnerClaimService,
  resolveBootstrapOwnerClaimConfig,
} from '../../src/server/bootstrap-owner-claim-service.js';

test('resolveBootstrapOwnerClaimConfig returns disabled when no owner-claim env is configured', () => {
  const config = resolveBootstrapOwnerClaimConfig({});

  assert.deepEqual(config, {
    required: false,
    claimCode: null,
    email: null,
    username: null,
  });
});

test('resolveBootstrapOwnerClaimConfig rejects incomplete owner-claim env combinations', () => {
  assert.throws(
    () => resolveBootstrapOwnerClaimConfig({
      [bootstrapOwnerUsernameEnvVar]: 'owner-admin',
    }),
    new RegExp(bootstrapOwnerClaimCodeEnvVar),
  );

  assert.throws(
    () => resolveBootstrapOwnerClaimConfig({
      [bootstrapOwnerClaimCodeEnvVar]: 'owner-claim-code-1234',
    }),
    new RegExp(`${bootstrapOwnerUsernameEnvVar}|${bootstrapOwnerEmailEnvVar}`),
  );
});

test('resolveBootstrapOwnerClaimConfig normalizes username, email, and claim code', () => {
  const config = resolveBootstrapOwnerClaimConfig({
    [bootstrapOwnerUsernameEnvVar]: ' Owner.Admin ',
    [bootstrapOwnerEmailEnvVar]: ' Owner@example.com ',
    [bootstrapOwnerClaimCodeEnvVar]: ' owner-claim-code-1234 ',
  });

  assert.deepEqual(config, {
    required: true,
    claimCode: 'owner-claim-code-1234',
    email: 'owner@example.com',
    username: 'owner.admin',
  });
});

test('createBootstrapOwnerClaimService returns a masked public status payload', () => {
  const service = createBootstrapOwnerClaimService({
    env: {
      [bootstrapOwnerUsernameEnvVar]: 'owner-admin',
      [bootstrapOwnerEmailEnvVar]: 'owner@example.com',
      [bootstrapOwnerClaimCodeEnvVar]: 'owner-claim-code-1234',
    },
  });

  assert.deepEqual(service.buildBootstrapOwnerClaimStatus(), {
    required: true,
    authMethods: ['local'],
    usernameHint: 'owner-admin',
    emailHint: 'o***@e***.com',
    emailRequired: true,
    usernameRequired: true,
  });
});

test('createBootstrapOwnerClaimService accepts matching local owner claims', () => {
  const service = createBootstrapOwnerClaimService({
    env: {
      [bootstrapOwnerUsernameEnvVar]: 'owner-admin',
      [bootstrapOwnerEmailEnvVar]: 'owner@example.com',
      [bootstrapOwnerClaimCodeEnvVar]: 'owner-claim-code-1234',
    },
  });

  assert.deepEqual(service.assertLocalOwnerClaim({
    claimCode: 'owner-claim-code-1234',
    email: 'owner@example.com',
    username: 'owner-admin',
  }), {
    email: 'owner@example.com',
    username: 'owner-admin',
  });
});

test('createBootstrapOwnerClaimService rejects mismatched claim code or owner identity', () => {
  const service = createBootstrapOwnerClaimService({
    env: {
      [bootstrapOwnerUsernameEnvVar]: 'owner-admin',
      [bootstrapOwnerEmailEnvVar]: 'owner@example.com',
      [bootstrapOwnerClaimCodeEnvVar]: 'owner-claim-code-1234',
    },
  });

  assert.throws(
    () => service.assertLocalOwnerClaim({
      claimCode: 'wrong-code-123456',
      email: 'owner@example.com',
      username: 'owner-admin',
    }),
    (error) => error?.code === 'bootstrap_owner_claim_invalid',
  );

  assert.throws(
    () => service.assertLocalOwnerClaim({
      claimCode: 'owner-claim-code-1234',
      email: 'wrong@example.com',
      username: 'owner-admin',
    }),
    (error) => error?.code === 'bootstrap_owner_claim_invalid',
  );
});
