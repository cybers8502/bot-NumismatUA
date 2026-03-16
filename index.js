require('dotenv').config({
  path: `.env.${process.env.NODE_ENV || 'development'}`,
});

const { Bot } = require('grammy');
const { setupBot } = require('./app/setupBot');

const bot = new Bot(process.env.BOT_TOKEN);

setupBot(bot);

bot.start({
  onStart: () => console.log('Bot is running'),
});
