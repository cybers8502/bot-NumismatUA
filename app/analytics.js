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
        // Nested map, not a dotted key: set() treats `byType.x` literally.
        byType: { [type]: admin.firestore.FieldValue.increment(1) },
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
 * Records that a user blocked or unblocked the bot (Telegram `my_chat_member`).
 * Unlike logEvent this does not touch lastSeen/eventCount — blocking is not
 * user activity. Admins are skipped, same as logEvent.
 * @param {number|string} userId Telegram user id
 * @param {boolean} blocked true = user blocked the bot, false = unblocked it
 */
async function setBlockedStatus(userId, blocked) {
  if (isAdminId(userId)) return;
  const type = blocked ? 'blocked' : 'unblocked';
  try {
    const firestore = getDb();
    const batch = firestore.batch();
    const now = admin.firestore.FieldValue.serverTimestamp();

    batch.set(firestore.collection('bot_events').doc(), {
      type,
      userId: String(userId),
      meta: {},
      createdAt: now,
    });

    batch.set(
      firestore.collection('bot_stats').doc('counters'),
      {
        // Nested map, not a dotted key: set() treats `byType.x` literally.
        byType: { [type]: admin.firestore.FieldValue.increment(1) },
        total: admin.firestore.FieldValue.increment(1),
      },
      { merge: true },
    );

    batch.set(
      firestore.collection('bot_users').doc(String(userId)),
      { blocked, blockedStatusAt: now },
      { merge: true },
    );

    await batch.commit();
  } catch (err) {
    console.error('[analytics] setBlockedStatus failed:', type, err.message);
  }
}

/**
 * @returns {Promise<{ byType: Record<string, number>, total: number, uniqueUsers: number, blockedUsers: number }>}
 */
async function getStatsSummary() {
  const firestore = getDb();

  const [countersSnap, usersCountSnap, blockedCountSnap] = await Promise.all([
    firestore.collection('bot_stats').doc('counters').get(),
    firestore.collection('bot_users').count().get(),
    firestore
      .collection('bot_users')
      .where('blocked', '==', true)
      .count()
      .get(),
  ]);

  const counters = countersSnap.exists ? countersSnap.data() : {};

  return {
    byType: counters.byType || {},
    total: counters.total || 0,
    uniqueUsers: usersCountSnap.data().count,
    blockedUsers: blockedCountSnap.data().count,
  };
}

module.exports = { logEvent, setBlockedStatus, getStatsSummary };
