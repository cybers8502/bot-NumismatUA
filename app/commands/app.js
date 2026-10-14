'use strict';

const { InlineKeyboard } = require('grammy');
const { getWebAppUrl } = require('../webapp');

async function handleApp(ctx) {
  const url = getWebAppUrl();
  if (!url) {
    await ctx.reply('Додаток поки що недоступний.');
    return;
  }

  await ctx.reply('Відкрийте нумізматичний каталог у додатку:', {
    reply_markup: new InlineKeyboard().webApp('📱 Відкрити додаток', url),
  });
}

module.exports = { handleApp };
