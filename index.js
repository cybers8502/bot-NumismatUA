require('dotenv').config({ path: `.env.${process.env.NODE_ENV || 'development'}` });

const { Bot } = require('grammy');
const { handleStart } = require('./app/commands/start');
const { handleSearch } = require('./app/commands/search');
const { handleCoinCallback, handleAddCallback } = require('./app/handlers/callbacks');

const bot = new Bot(process.env.BOT_TOKEN);

bot.command('start', handleStart);
bot.command('search', handleSearch);

bot.callbackQuery(/^coin_(\d+)$/, handleCoinCallback);
bot.callbackQuery(/^add_(\d+)$/, handleAddCallback);

bot.catch((err) => {
  console.error('Bot error:', err.message, err.ctx?.update);
});

bot.start({ onStart: () => console.log('Bot is running') });