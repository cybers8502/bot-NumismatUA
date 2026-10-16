'use strict';

const admin = require('firebase-admin');

// Best-effort event logging to Firestore. Never throws — a stats outage
// must not break the bot's actual functionality.

let db = null;

function getDb() {
  if (db) return db;
  if (!admin.apps.length) {
    admin.initializeApp();
  }
  db = admin.firestore();
  return db;
}

function isAdminId(userId) {
  return (process.env.BOT_ADMIN_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(String(userId));
}

/**
 * Events from users listed in BOT_ADMIN_IDS are not recorded.
 * @param {string} type e.g. 'start', 'search', 'register_success', 'login_fail'
 * @param {number|string} userId Telegram user id
 * @param {object} [meta] extra fields to store on the event doc (e.g. { query: '...' })
 */
async function logEvent(type, userId, meta = {}) {
  if (isAdminId(userId)) return;
  try {
    const firestore = getDb();
    const batch = firestore.batch();

    batch.set(firestore.collection('bot_events').doc(), {
      type,
      userId: String(userId),
      meta,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    batch.set(
      firestore.collection('bot_stats').doc('counters'),
      {
        [`byType.${type}`]: admin.firestore.FieldValue.increment(1),
        total: admin.firestore.FieldValue.increment(1),
      },
      { merge: true },
    );

    batch.set(
      firestore.collection('bot_users').doc(String(userId)),
      {
        lastSeen: admin.firestore.FieldValue.serverTimestamp(),
        eventCount: admin.firestore.FieldValue.increment(1),
      },
      { merge: true },
    );

    await batch.commit();
  } catch (err) {
    console.error('[analytics] logEvent failed:', type, err.message);
  }
}

/**
 * @returns {Promise<{ byType: Record<string, number>, total: number, uniqueUsers: number }>}
 */
async function getStatsSummary() {
  const firestore = getDb();

  const [countersSnap, usersCountSnap] = await Promise.all([
    firestore.collection('bot_stats').doc('counters').get(),
    firestore.collection('bot_users').count().get(),
  ]);

  const counters = countersSnap.exists ? countersSnap.data() : {};

  return {
    byType: counters.byType || {},
    total: counters.total || 0,
    uniqueUsers: usersCountSnap.data().count,
  };
}

module.exports = { logEvent, getStatsSummary };
