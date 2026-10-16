'use strict';

const { getStatsSummary } = require('../analytics');

function isAdmin(userId) {
  const raw = process.env.BOT_ADMIN_IDS || '';
  const ids = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  // No allowlist configured — leave the command open (dev/small-scale default).
  if (!ids.length) return true;
  return ids.includes(String(userId));
}

async function handleStats(ctx) {
  if (!isAdmin(ctx.from.id)) {
    return ctx.reply('⛔️ Ця команда доступна лише адміністраторам бота.');
  }

  let summary;
  try {
    summary = await getStatsSummary();
  } catch (err) {
    console.error('[stats] getStatsSummary failed:', err.message);
    return ctx.reply('⚠️ Не вдалося отримати статистику. Спробуйте пізніше.');
  }

  const byType = summary.byType;
  const lines = [
    '<b>📊 Статистика бота</b>',
    '',
    `👥 Унікальних користувачів: <b>${summary.uniqueUsers}</b>`,
    `🚫 Заблокували бота: <b>${summary.blockedUsers}</b>`,
    `🚀 /start: <b>${byType.start ?? 0}</b>`,
    `🔍 Пошуків: <b>${byType.search ?? 0}</b>`,
    `📝 Реєстрацій: <b>${byType.register_success ?? 0}</b> (невдалих: ${byType.register_fail ?? 0})`,
    `🔑 Логінів: <b>${byType.login_success ?? 0}</b> (невдалих: ${byType.login_fail ?? 0})`,
    `❓ Запитів відновлення пароля: <b>${byType.password_reset_requested ?? 0}</b> (успішних: ${byType.password_reset_success ?? 0})`,
    `➕ Додано в колекцію: <b>${byType.add_to_collection ?? 0}</b>`,
    '',
    `Разом подій: <b>${summary.total}</b>`,
  ];

  await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
}

module.exports = { handleStats };
