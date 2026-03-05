'use strict';

const { InlineKeyboard } = require('grammy');
const { searchCoins } = require('../api');

function getCoinTitle(coin) {
  return coin.title?.rendered || coin.name || `Монета #${coin.id}`;
}

async function handleSearch(ctx) {
  const query = ctx.match?.trim();

  if (!query) {
    return ctx.reply('Вкажіть назву монети.\nНаприклад: <code>/search 1 гривня</code>', {
      parse_mode: 'HTML',
    });
  }

  let coins;
  try {
    coins = await searchCoins(query);
  } catch (err) {
    return ctx.reply('⚠️ Не вдалося підключитися до API. Спробуйте пізніше.');
  }

  if (!Array.isArray(coins) || coins.length === 0) {
    return ctx.reply(`Монети за запитом "<b>${escapeHtml(query)}</b>" не знайдено.`, {
      parse_mode: 'HTML',
    });
  }

  const keyboard = new InlineKeyboard();
  for (const coin of coins) {
    keyboard.text(getCoinTitle(coin), `coin_${coin.id}`).row();
  }

  await ctx.reply(
    `Знайдено <b>${coins.length}</b> монет за запитом "<b>${escapeHtml(query)}</b>":`,
    { parse_mode: 'HTML', reply_markup: keyboard },
  );
}

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

module.exports = { handleSearch };