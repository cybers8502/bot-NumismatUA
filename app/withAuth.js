'use strict';

const {
  getAuthToken,
  getRefreshToken,
  setAuthToken,
  clearSession,
} = require('./session');
const { refreshAuthToken } = require('./api');

const AUTH_ERRORS = [
  'Expired token',
  'invalid-secret-key',
  'jwt expired',
  'Expired',
  'invalid token',
  'signature verification failed',
  'Not logged in',
];

function isAuthError(err) {
  const matched = AUTH_ERRORS.some((msg) =>
    err.message.toLowerCase().includes(msg.toLowerCase()),
  );
  if (!matched) {
    console.log(
      '[withAuth] error is NOT auth-related, message:',
      JSON.stringify(err.message),
    );
  }
  return matched;
}

/**
 * Decodes JWT exp field (no signature verification, for logging only).
 * Returns ISO string or null.
 */
function decodeJwtExp(token) {
  try {
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64url').toString('utf8'),
    );
    if (!payload.exp) return null;
    return new Date(payload.exp * 1000).toISOString();
  } catch {
    return null;
  }
}

/**
 * Calls fn(authToken). On auth error, refreshes the token and retries once.
 * Throws if not logged in or refresh fails.
 */
async function withAuth(userId, fn) {
  const authToken = getAuthToken(userId);
  if (!authToken) {
    console.log(
      '[withAuth] userId',
      userId,
      '— no authToken in session (not logged in)',
    );
    throw new Error('not-logged-in');
  }

  const authExp = decodeJwtExp(authToken);
  console.log(
    '[withAuth] userId',
    userId,
    '— authToken exp:',
    authExp ?? 'unknown',
    '| now:',
    new Date().toISOString(),
    authExp && new Date(authExp) < new Date() ? '(EXPIRED)' : '(valid)',
  );

  try {
    return await fn(authToken);
  } catch (err) {
    if (!isAuthError(err)) throw err;

    console.log(
      '[withAuth] auth error for userId',
      userId,
      '— message:',
      JSON.stringify(err.message),
    );

    const refreshToken = getRefreshToken(userId);
    if (!refreshToken) {
      console.log(
        '[withAuth] userId',
        userId,
        '— no refreshToken, clearing session',
      );
      clearSession(userId);
      throw new Error('session-expired');
    }

    const refreshExp = decodeJwtExp(refreshToken);
    console.log(
      '[withAuth] userId',
      userId,
      '— refreshToken exp:',
      refreshExp ?? 'unknown',
      refreshExp && new Date(refreshExp) < new Date()
        ? '(EXPIRED — refresh will fail)'
        : '(valid)',
    );

    console.log('[withAuth] attempting token refresh for userId', userId);
    let newToken;
    try {
      newToken = await refreshAuthToken(refreshToken);
    } catch (refreshErr) {
      console.error(
        '[withAuth] refresh FAILED for userId',
        userId,
        '— reason:',
        refreshErr.message,
      );
      clearSession(userId);
      throw new Error('session-expired');
    }

    const newExp = decodeJwtExp(newToken);
    console.log(
      '[withAuth] refresh SUCCESS for userId',
      userId,
      '— new authToken exp:',
      newExp ?? 'unknown',
    );

    setAuthToken(userId, newToken);
    return await fn(newToken);
  }
}

module.exports = { withAuth, decodeJwtExp };
