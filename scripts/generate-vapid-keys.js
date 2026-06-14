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

import { generateVapidKeyPair } from '../src/server/push/vapid-keys.js';

const keys = generateVapidKeyPair();

process.stdout.write(
  '# Store these once in the Harmoniarr server environment or secret store.\n' +
  '# Keep VAPID_PRIVATE_KEY private; do not commit it to source control.\n' +
  `VAPID_PUBLIC_KEY=${keys.publicKey}\n` +
  `VAPID_PRIVATE_KEY=${keys.privateKey}\n` +
  'VAPID_CONTACT=mailto:admin@example.com\n',
);
