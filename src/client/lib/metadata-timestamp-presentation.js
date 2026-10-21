/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */

// This presentation boundary accepts explicit-zone ISO instants, not local dates.
const instantPattern = /^(?!0000)\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/u;

function toInstant(value) {
  if (typeof value !== 'string' || !instantPattern.test(value)) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.getUTCFullYear() < 1 || date.getUTCFullYear() > 9999) return null;
  // Date accepts some impossible dates by rolling into the following month.
  const calendarDate = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  if (calendarDate.toISOString().slice(0, 10) !== value.slice(0, 10)) return null;
  return date;
}

export function createMetadataTimestampFormatter({ locales, timeZone } = {}) {
  const formatter = new Intl.DateTimeFormat(locales, {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit',
    minute: '2-digit', second: '2-digit', timeZoneName: 'shortOffset', timeZone,
  });
  return value => {
    const date = toInstant(value);
    return date ? { dateTime: date.toISOString(), label: formatter.format(date) } : null;
  };
}

export const formatMetadataTimestamp = createMetadataTimestampFormatter();
