/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

function parseCookiePair(setCookieValue) {
  const cookieLine = String(setCookieValue ?? '');
  const semicolonIndex = cookieLine.indexOf(';');
  const pair = semicolonIndex === -1 ? cookieLine : cookieLine.slice(0, semicolonIndex);
  const separatorIndex = pair.indexOf('=');
  if (separatorIndex <= 0) {
    return null;
  }

  return {
    name: pair.slice(0, separatorIndex).trim(),
    value: pair.slice(separatorIndex + 1),
  };
}

function getSetCookieHeaders(response) {
  if (typeof response.headers.getSetCookie === 'function') {
    return response.headers.getSetCookie();
  }

  const singleHeader = response.headers.get('set-cookie');
  return singleHeader ? [singleHeader] : [];
}

function shouldAttachCsrfHeader(method, includeCsrfHeader) {
  if (includeCsrfHeader !== null) {
    return includeCsrfHeader;
  }

  return !['GET', 'HEAD'].includes(method);
}

export function createSessionHttpClient(baseUrl) {
  const cookies = new Map();
  let csrfToken = null;

  function buildCookieHeader() {
    return [...cookies.entries()]
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  }

  function applyResponseState(response, payload) {
    for (const setCookieValue of getSetCookieHeaders(response)) {
      const parsedCookie = parseCookiePair(setCookieValue);
      if (!parsedCookie) {
        continue;
      }

      cookies.set(parsedCookie.name, parsedCookie.value);
    }

    if (payload && typeof payload === 'object' && typeof payload.csrfToken === 'string') {
      csrfToken = payload.csrfToken;
    }
  }

  async function requestJson(path, {
    csrf = null,
    headers = {},
    json = undefined,
    method = 'GET',
  } = {}) {
    const normalizedMethod = method.toUpperCase();
    const requestHeaders = new Headers(headers);
    const cookieHeader = buildCookieHeader();

    if (cookieHeader) {
      requestHeaders.set('cookie', cookieHeader);
    }

    if (json !== undefined) {
      requestHeaders.set('accept', 'application/json');
      requestHeaders.set('content-type', 'application/json');
    }

    if (csrfToken && shouldAttachCsrfHeader(normalizedMethod, csrf)) {
      requestHeaders.set('x-csrf-token', csrfToken);
    }

    const response = await fetch(`${baseUrl}${path}`, {
      body: json === undefined ? undefined : JSON.stringify(json),
      headers: requestHeaders,
      method: normalizedMethod,
    });
    const payload = await response.json();

    applyResponseState(response, payload);

    return {
      payload,
      response,
    };
  }

  return {
    getCookieHeader: buildCookieHeader,
    getCsrfToken() {
      return csrfToken;
    },
    requestJson,
  };
}
