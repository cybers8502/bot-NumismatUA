'use strict';

const { handleStart } = require('./commands/start');
const { handleSearch } = require('./commands/search');
const { handleCollection } = require('./commands/collection');
const {
  getMainKeyboard,
  BTN_SEARCH,
  BTN_COLLECTION,
  BTN_LOGIN,
} = require('./keyboard');
const { handleApp } = require('./commands/app');
const { getWebAppUrl } = require('./webapp');
const { handleStats } = require('./commands/stats');
const {
  handleLogin,
  handleLoginCallback,
  handleRegisterCallback,
  handleForgotPasswordCallback,
  handleLogoutCallback,
  handleAuthMessage,
} = require('./commands/login');
const {
  handleCoinCallback,
  handleAddCallback,
  handleGalleryCallback,
  handleChartCallback,
} = require('./handlers/callbacks');

/**
 * Register all commands, callback queries, and message handlers on a bot instance.
 * Used by both index.js (long-polling) and functions.js (webhook).
 *
 * @param {import('grammy').Bot} bot
 */
function setupBot(bot) {
  bot.command('start', handleStart);
  bot.command('search', handleSearch);
  bot.command('collection', handleCollection);
  bot.command('login', handleLogin);
  bot.command('app', handleApp);
  bot.command('stats', handleStats);

  // Bottom-keyboard buttons send their label as plain text; route them to the
  // matching command before the generic text handler treats them as a search.
  bot.hears(BTN_SEARCH, (ctx) =>
    ctx.reply('Введіть назву монети для пошуку.', {
      reply_markup: getMainKeyboard(),
    }),
  );
  bot.hears(BTN_COLLECTION, handleCollection);
  bot.hears(BTN_LOGIN, handleLogin);

  bot.callbackQuery('auth_login', handleLoginCallback);
  bot.callbackQuery('auth_register', handleRegisterCallback);
  bot.callbackQuery('auth_forgot_password', handleForgotPasswordCallback);
  bot.callbackQuery('auth_logout', handleLogoutCallback);
  bot.callbackQuery(/^coin_(\d+)$/, handleCoinCallback);
  bot.callbackQuery(/^add_(\d+)$/, handleAddCallback);
  bot.callbackQuery(/^gallery_(\d+)$/, handleGalleryCallback);
  bot.callbackQuery(/^chart_(\d+)$/, handleChartCallback);

  bot.on('message:text', async (ctx) => {
    const handled = await handleAuthMessage(ctx);
    if (!handled) {
      await handleSearch(ctx);
    }
  });

  bot.catch((err) => {
    console.error('Bot error:', err.message, err.ctx?.update);
  });

  // /stats is intentionally left out of the public menu — it's gated by
  // isAdmin() in handleStats, not something regular users need to see.
  bot.api
    .setMyCommands([
      { command: 'start', description: 'Почати роботу' },
      { command: 'search', description: 'Пошук монети за назвою' },
      { command: 'collection', description: 'Моя колекція' },
      { command: 'login', description: 'Авторизація' },
      ...(getWebAppUrl()
        ? [{ command: 'app', description: 'Відкрити додаток' }]
        : []),
    ])
    .then(() => console.log('Commands set'))
    .catch(console.error);

  // Replaces the default "Menu" button with one that opens the Mini App.
  const webAppUrl = getWebAppUrl();
  if (webAppUrl) {
    bot.api
      .setChatMenuButton({
        menu_button: {
          type: 'web_app',
          text: 'Відкрити додаток',
          web_app: { url: webAppUrl },
        },
      })
      .then(() => console.log('Menu button set'))
      .catch(console.error);
  }
}

module.exports = { setupBot };
