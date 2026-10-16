'use strict';

// One-off: find users who blocked the bot before my_chat_member tracking was
// deployed, and mark them blocked in Firestore (bot_users/<id>.blocked).
//
// Telegram has no "list blocked users" call, so every bot_users id gets a
// silent sendChatAction('typing'); a 403 means the user blocked the bot.
// Users who have NOT blocked the bot briefly see "typing…" (a few seconds).
//
// Dry run by default. Nothing is written without --apply.
//
//   node scripts/backfill-blocked.js            # report only
//   node scripts/backfill-blocked.js --apply    # write blocked flags
//
// Env:
//   BOT_TOKEN        read from the env file below, never printed
//   ENV_FILE         env file to load (default .env.development)
//   GOOGLE_CLOUD_PROJECT  Firestore project (default numismat-8502)
//
// Firestore access uses Application Default Credentials:
//   gcloud auth application-default login

require('dotenv').config({ path: process.env.ENV_FILE || '.env.development' });

const admin = require('firebase-admin');

const APPLY = process.argv.includes('--apply');
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || 'numismat-8502';
const DELAY_MS = 100; // stay far below Telegram's ~30 msgs/sec limit

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @returns {Promise<'ok'|'blocked'|'unknown'>}
 *   'unknown' = chat gone / user deactivated / other error; left untouched.
 */
async function probe(token, userId) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendChatAction`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chat_id: userId, action: 'typing' }),
      },
    );
    const body = await res.json();

    if (body.ok) return 'ok';
    if (res.status === 429) {
      await sleep((body.parameters?.retry_after ?? 1) * 1000 + 100);
      continue;
    }
    if (res.status === 403 && /blocked by the user/i.test(body.description)) {
      return 'blocked';
    }
    console.log(`  ${userId}: ${res.status} ${body.description}`);
    return 'unknown';
  }
  return 'unknown';
}

async function main() {
  const token = process.env.BOT_TOKEN;
  if (!token) {
    console.error('BOT_TOKEN is not set (check ENV_FILE).');
    process.exit(1);
  }

  admin.initializeApp({ projectId: PROJECT_ID });
  const db = admin.firestore();

  const snap = await db.collection('bot_users').get();
  console.log(
    `${snap.size} users in ${PROJECT_ID}. Mode: ${APPLY ? 'APPLY' : 'dry run'}\n`,
  );

  const counts = { ok: 0, blocked: 0, unknown: 0, changed: 0 };

  for (const doc of snap.docs) {
    const result = await probe(token, doc.id);
    counts[result]++;

    const stored = doc.data().blocked === true;
    // Only touch docs whose state is provably different from what is stored.
    const shouldChange =
      (result === 'blocked' && !stored) || (result === 'ok' && stored);

    if (shouldChange) {
      counts.changed++;
      const blocked = result === 'blocked';
      console.log(`  ${doc.id}: ${blocked ? 'BLOCKED' : 'unblocked'}`);
      if (APPLY) {
        await doc.ref.set(
          {
            blocked,
            blockedStatusAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      }
    }
    await sleep(DELAY_MS);
  }

  console.log(
    `\nactive: ${counts.ok}, blocked: ${counts.blocked}, unknown: ${counts.unknown}`,
  );
  console.log(
    `${counts.changed} doc(s) ${APPLY ? 'updated' : 'would be updated (rerun with --apply)'}.`,
  );
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
