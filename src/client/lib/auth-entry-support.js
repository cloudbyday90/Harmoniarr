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

const authEntrySupportDefinitions = Object.freeze({
  login: Object.freeze([
    Object.freeze({
      description: 'Use a one-time code from an administrator to set a first local password for an existing account.',
      id: 'claim-account',
      label: 'Claim an existing account',
      routeName: 'claim-account',
    }),
  ]),
  'claim-account': Object.freeze([
    Object.freeze({
      description: 'After setting a password, return to the normal login screen and sign in with that account.',
      id: 'login',
      label: 'Return to local login',
      routeName: 'login',
    }),
    Object.freeze({
      description: 'Bootstrap-admin recovery is for emergency operator access, not ordinary account onboarding.',
      id: 'recovery',
      label: 'Need emergency admin recovery?',
      routeName: 'recovery',
    }),
  ]),
  bootstrap: Object.freeze([
    Object.freeze({
      description: 'After first-run setup is complete, everyone returns through the standard local login screen.',
      id: 'login-later',
      label: 'Normal login comes next',
    }),
    Object.freeze({
      description: 'Claim codes are only for accounts that already exist. They are not the first-run bootstrap path.',
      id: 'claim-scope',
      label: 'Claim-account is a later flow',
    }),
  ]),
  recovery: Object.freeze([
    Object.freeze({
      description: 'Use normal local login after admin recovery is complete or when emergency recovery is not required.',
      id: 'login',
      label: 'Return to local login',
      routeName: 'login',
    }),
    Object.freeze({
      description: 'Claim-account is the ordinary path for existing non-admin accounts that were issued a claim code.',
      id: 'claim-account',
      label: 'Claim a standard account instead',
      routeName: 'claim-account',
    }),
  ]),
});

function buildRouteTarget(routeName, { username } = {}) {
  if (routeName === 'claim-account' && typeof username === 'string' && username.trim().length > 0) {
    return {
      name: routeName,
      query: {
        username: username.trim(),
      },
    };
  }

  if (routeName === 'login' && typeof username === 'string' && username.trim().length > 0) {
    return {
      name: routeName,
      query: {
        username: username.trim(),
      },
    };
  }

  return {
    name: routeName,
  };
}

export function buildAuthEntrySupportItems(surfaceId, options = {}) {
  return (authEntrySupportDefinitions[surfaceId] ?? []).map((item) => ({
    ...item,
    to: item.routeName ? buildRouteTarget(item.routeName, options) : null,
  }));
}

/**
 * Returns the AuthEntryShell `:title` prop for the bootstrap setup screen.
 * When the install has a pre-configured owner that must be claimed, the title
 * reflects the claim flow; otherwise it reflects the free-create flow.
 *
 * @param {{ required?: boolean }|null|undefined} ownerClaimSummary
 * @returns {string}
 */
export function getBootstrapTitle(ownerClaimSummary) {
  return ownerClaimSummary?.required
    ? 'Claim the configured owner account'
    : 'Create the first admin account';
}

/**
 * Returns the inner `<h2>` heading for the bootstrap setup form card.
 * Shorter than the shell title — same required/free-create branching.
 *
 * @param {{ required?: boolean }|null|undefined} ownerClaimSummary
 * @returns {string}
 */
export function getBootstrapHeading(ownerClaimSummary) {
  return ownerClaimSummary?.required
    ? 'Claim owner account'
    : 'Create admin account';
}