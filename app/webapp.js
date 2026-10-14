'use strict';

/**
 * Telegram requires an https URL for Mini Apps, so anything else is treated as
 * "not configured" and the app buttons are simply not shown.
 */
function getWebAppUrl() {
  const url = (process.env.WEBAPP_URL || '').trim();
  return url.startsWith('https://') ? url : null;
}

module.exports = { getWebAppUrl };
