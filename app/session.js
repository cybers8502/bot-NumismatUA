'use strict';

// userId (number) -> { state, username?, authToken?, refreshToken? }
const sessions = new Map();

function getSession(userId) {
  return sessions.get(userId) || { state: null };
}

function setSession(userId, data) {
  sessions.set(userId, data);
}

function clearSession(userId) {
  sessions.delete(userId);
}

function getAuthToken(userId) {
  return getSession(userId).authToken || null;
}

function getRefreshToken(userId) {
  return getSession(userId).refreshToken || null;
}

function setAuthToken(userId, authToken) {
  const s = getSession(userId);
  sessions.set(userId, { ...s, authToken });
}

function isLoggedIn(userId) {
  return Boolean(getSession(userId).authToken);
}

module.exports = {
  getSession,
  setSession,
  clearSession,
  getAuthToken,
  getRefreshToken,
  setAuthToken,
  isLoggedIn,
};
