'use strict';

const { InlineKeyboard } = require('grammy');
const {
  getSession,
  setSession,
  clearSession,
  getAuthToken,
  isLoggedIn,
} = require('../session');
const { escapeHtml } = require('../utils');
const { loginUser, logoutUser } = require('../api');
const { decodeJwtExp } = require('../withAuth');

async function handleLogin(ctx) {
  const userId = ctx.from.id;

  if (isLoggedIn(userId)) {
    const { username } = getSession(userId);
    const keyboard = new InlineKeyboard().text('🚪 Вийти', 'auth_logout');
    return ctx.reply(`✅ Ви авторизовані як <b>${escapeHtml(username)}</b>`, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  }

  const keyboard = new InlineKeyboard().text('🔑 Увійти', 'auth_login');
  await ctx.reply(
    '🔐 <b>Авторизація</b>\n\nВведіть облікові дані WordPress для доступу до колекції.',
    { parse_mode: 'HTML', reply_markup: keyboard },
  );
}

async function handleLoginCallback(ctx) {
  await ctx.answerCallbackQuery();
  const userId = ctx.from.id;
  setSession(userId, { state: 'awaiting_username' });
  await ctx.reply('Введіть ваш логін WordPress:');
}

async function handleLogoutCallback(ctx) {
  await ctx.answerCallbackQuery();
  const authToken = getAuthToken(ctx.from.id);
  if (authToken) {
    try {
      await logoutUser(authToken);
    } catch (err) {
      console.error('[login] logoutUser failed:', err.message);
    }
  }
  console.log('[login] userId', ctx.from.id, '— logout, clearing session');
  clearSession(ctx.from.id);
  await ctx.reply('👋 Ви вийшли з системи.');
}

/**
 * Intercepts text messages during the auth flow.
 * Returns true if the message was consumed, false otherwise.
 */
async function handleAuthMessage(ctx) {
  const userId = ctx.from.id;
  const session = getSession(userId);

  if (session.state === 'awaiting_username') {
    const username = ctx.message.text.trim();
    setSession(userId, { state: 'awaiting_password', username });
    await ctx.reply('Введіть пароль застосунку WordPress:');
    return true;
  }

  if (session.state === 'awaiting_password') {
    const password = ctx.message.text.trim();
    // Try to delete the password message for security
    try {
      await ctx.deleteMessage();
    } catch {
      // Ignore if not possible
    }

    let authToken, refreshToken;
    try {
      const result = await loginUser(session.username, password);
      authToken = result.authToken;
      refreshToken = result.refreshToken;
    } catch (err) {
      console.error('[login] loginUser failed:', session.username, err.message);
      setSession(userId, { state: null });
      await ctx.reply(
        '❌ Невірний логін або пароль. Спробуйте ще раз командою /login.',
      );
      return true;
    }

    setSession(userId, {
      state: null,
      username: session.username,
      authToken,
      refreshToken,
    });
    console.log(
      '[login] userId',
      userId,
      'username',
      session.username,
      '— authToken exp:',
      decodeJwtExp(authToken) ?? 'unknown',
      '| refreshToken exp:',
      decodeJwtExp(refreshToken) ?? 'unknown',
    );
    await ctx.reply(
      `✅ Авторизовано як <b>${escapeHtml(session.username)}</b>!`,
      { parse_mode: 'HTML' },
    );
    return true;
  }

  return false;
}

module.exports = {
  handleLogin,
  handleLoginCallback,
  handleLogoutCallback,
  handleAuthMessage,
};
