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
const {
  loginUser,
  logoutUser,
  registerUser,
  sendPasswordResetEmail,
  resetUserPassword,
} = require('../api');
const { decodeJwtExp } = require('../withAuth');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseResetLink(text) {
  const keyMatch = text.match(/[?&]key=([^&\s]+)/);
  const loginMatch = text.match(/[?&]login=([^&\s]+)/);
  if (!keyMatch || !loginMatch) return null;
  return {
    key: decodeURIComponent(keyMatch[1]),
    login: decodeURIComponent(loginMatch[1]),
  };
}

async function tryDeleteMessage(ctx) {
  try {
    await ctx.deleteMessage();
  } catch {
    // Ignore if not possible (e.g. group chat without delete rights)
  }
}

async function completeLogin(ctx, userId, username, password) {
  const result = await loginUser(username, password);
  setSession(userId, {
    state: null,
    username,
    authToken: result.authToken,
    refreshToken: result.refreshToken,
  });
  console.log(
    '[login] userId',
    userId,
    'username',
    username,
    '— authToken exp:',
    decodeJwtExp(result.authToken) ?? 'unknown',
    '| refreshToken exp:',
    decodeJwtExp(result.refreshToken) ?? 'unknown',
  );
  await ctx.reply(`✅ Авторизовано як <b>${escapeHtml(username)}</b>!`, {
    parse_mode: 'HTML',
  });
}

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

  const keyboard = new InlineKeyboard()
    .text('🔑 Увійти', 'auth_login')
    .row()
    .text('📝 Зареєструватися', 'auth_register')
    .row()
    .text('❓ Забули пароль?', 'auth_forgot_password');

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

async function handleRegisterCallback(ctx) {
  await ctx.answerCallbackQuery();
  const userId = ctx.from.id;
  setSession(userId, { state: 'awaiting_reg_username' });
  await ctx.reply('📝 Придумайте логін (username):');
}

async function handleForgotPasswordCallback(ctx) {
  await ctx.answerCallbackQuery();
  const userId = ctx.from.id;
  setSession(userId, { state: 'awaiting_reset_identifier' });
  await ctx.reply('Введіть ваш логін або email:');
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

  // --- Login ---

  if (session.state === 'awaiting_username') {
    const username = ctx.message.text.trim();
    setSession(userId, { state: 'awaiting_password', username });
    await ctx.reply('Введіть пароль застосунку WordPress:');
    return true;
  }

  if (session.state === 'awaiting_password') {
    const password = ctx.message.text.trim();
    await tryDeleteMessage(ctx);

    try {
      await completeLogin(ctx, userId, session.username, password);
    } catch (err) {
      console.error('[login] loginUser failed:', session.username, err.message);
      setSession(userId, { state: null });
      await ctx.reply(
        '❌ Невірний логін або пароль. Спробуйте ще раз командою /login.',
      );
    }
    return true;
  }

  // --- Registration ---

  if (session.state === 'awaiting_reg_username') {
    const username = ctx.message.text.trim();
    if (!username) {
      await ctx.reply('Логін не може бути порожнім. Спробуйте ще раз:');
      return true;
    }
    setSession(userId, { state: 'awaiting_reg_email', regUsername: username });
    await ctx.reply('Введіть ваш email:');
    return true;
  }

  if (session.state === 'awaiting_reg_email') {
    const email = ctx.message.text.trim();
    if (!EMAIL_RE.test(email)) {
      await ctx.reply('⚠️ Схоже, це не email. Спробуйте ще раз:');
      return true;
    }
    setSession(userId, {
      state: 'awaiting_reg_password',
      regUsername: session.regUsername,
      regEmail: email,
    });
    await ctx.reply('Придумайте пароль (мінімум 6 символів):');
    return true;
  }

  if (session.state === 'awaiting_reg_password') {
    const password = ctx.message.text.trim();
    await tryDeleteMessage(ctx);

    if (password.length < 6) {
      await ctx.reply(
        '⚠️ Пароль замалий (мінімум 6 символів). Спробуйте ще раз:',
      );
      return true;
    }

    const { regUsername, regEmail } = session;
    try {
      await registerUser(regUsername, regEmail, password);
    } catch (err) {
      console.error('[login] registerUser failed:', regUsername, err.message);
      setSession(userId, { state: null });
      await ctx.reply(
        `❌ Не вдалося зареєструватися: ${escapeHtml(err.message)}\n\nСпробуйте ще раз командою /login.`,
        { parse_mode: 'HTML' },
      );
      return true;
    }

    try {
      await completeLogin(ctx, userId, regUsername, password);
      await ctx.reply('🎉 Реєстрація успішна!');
    } catch (err) {
      console.error(
        '[login] auto-login after register failed:',
        regUsername,
        err.message,
      );
      setSession(userId, { state: null });
      await ctx.reply(
        '🎉 Реєстрація успішна, але автоматичний вхід не вдався. Увійдіть командою /login.',
      );
    }
    return true;
  }

  // --- Password reset ---

  if (session.state === 'awaiting_reset_identifier') {
    const identifier = ctx.message.text.trim();
    try {
      await sendPasswordResetEmail(identifier);
    } catch (err) {
      console.error(
        '[login] sendPasswordResetEmail failed:',
        identifier,
        err.message,
      );
      // Fall through to the same generic message regardless — the backend
      // itself obfuscates whether the account exists, to avoid enumeration.
    }
    setSession(userId, { state: 'awaiting_reset_link' });
    await ctx.reply(
      '📧 Якщо такий обліковий запис існує, на пошту надіслано лист із посиланням для відновлення пароля.\n\n' +
        'Відкрийте лист і надішліть сюди повне посилання з нього (скопіюйте весь рядок з адресного рядка).',
    );
    return true;
  }

  if (session.state === 'awaiting_reset_link') {
    const parsed = parseResetLink(ctx.message.text.trim());
    if (!parsed) {
      await ctx.reply(
        '⚠️ Не вдалося знайти код відновлення в цьому тексті. Надішліть повне посилання з листа ще раз:',
      );
      return true;
    }
    setSession(userId, {
      state: 'awaiting_reset_password',
      resetKey: parsed.key,
      resetLogin: parsed.login,
    });
    await ctx.reply('Введіть новий пароль (мінімум 6 символів):');
    return true;
  }

  if (session.state === 'awaiting_reset_password') {
    const password = ctx.message.text.trim();
    await tryDeleteMessage(ctx);

    if (password.length < 6) {
      await ctx.reply(
        '⚠️ Пароль замалий (мінімум 6 символів). Спробуйте ще раз:',
      );
      return true;
    }

    const { resetKey, resetLogin } = session;
    try {
      await resetUserPassword(resetKey, resetLogin, password);
    } catch (err) {
      console.error(
        '[login] resetUserPassword failed:',
        resetLogin,
        err.message,
      );
      setSession(userId, { state: null });
      await ctx.reply(
        `❌ Не вдалося скинути пароль: ${escapeHtml(err.message)}\n\nПочніть спочатку командою /login.`,
        { parse_mode: 'HTML' },
      );
      return true;
    }

    try {
      await completeLogin(ctx, userId, resetLogin, password);
      await ctx.reply('🔑 Пароль оновлено!');
    } catch (err) {
      console.error(
        '[login] auto-login after reset failed:',
        resetLogin,
        err.message,
      );
      setSession(userId, { state: null });
      await ctx.reply(
        '🔑 Пароль оновлено, але автоматичний вхід не вдався. Увійдіть командою /login.',
      );
    }
    return true;
  }

  return false;
}

module.exports = {
  handleLogin,
  handleLoginCallback,
  handleRegisterCallback,
  handleForgotPasswordCallback,
  handleLogoutCallback,
  handleAuthMessage,
};
