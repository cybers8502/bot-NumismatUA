'use strict';

const {
  getAuthToken,
  getRefreshToken,
  setAuthToken,
  clearSession,
} = require('./session');
const { refreshAuthToken } = require('./api');

const AUTH_ERRORS = ['Expired token', 'invalid-secret-key', 'jwt expired'];

function isAuthError(err) {
  return AUTH_ERRORS.some((msg) => err.message.includes(msg));
}

/**
 * Calls fn(authToken). On auth error, refreshes the token and retries once.
 * Throws if not logged in or refresh fails.
 */
async function withAuth(userId, fn) {
  const authToken = getAuthToken(userId);
  if (!authToken) throw new Error('not-logged-in');

  try {
    return await fn(authToken);
  } catch (err) {
    if (!isAuthError(err)) throw err;

    const refreshToken = getRefreshToken(userId);
    if (!refreshToken) {
      clearSession(userId);
      throw new Error('session-expired');
    }

    console.log('[withAuth] token expired, refreshing for userId', userId);
    const newToken = await refreshAuthToken(refreshToken);
    setAuthToken(userId, newToken);
    return await fn(newToken);
  }
}

module.exports = { withAuth };
