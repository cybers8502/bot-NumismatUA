'use strict';

const { handleStart } = require('./commands/start');
const { handleSearch } = require('./commands/search');
const { handleCollection } = require('./commands/collection');
const {
  handleLogin,
  handleLoginCallback,
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

  bot.callbackQuery('auth_login', handleLoginCallback);
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

  bot.api
    .setMyCommands([
      { command: 'start', description: 'Почати роботу' },
      { command: 'search', description: 'Пошук монети за назвою' },
      { command: 'collection', description: 'Моя колекція' },
      { command: 'login', description: 'Авторизація' },
    ])
    .then(() => console.log('Commands set'))
    .catch(console.error);
}

module.exports = { setupBot };
