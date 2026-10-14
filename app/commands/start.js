'use strict';

const { logEvent } = require('../analytics');
const { getMainKeyboard } = require('../keyboard');

async function handleStart(ctx) {
  logEvent('start', ctx.from.id);

  await ctx.reply(
    '<b>Вітаю у нумізматичному каталозі!</b>\n\n' +
      'Я допоможу вам:\n' +
      '  <b>/search &lt;назва&gt;</b> — знайти монету за назвою\n' +
      '  Переглянути деталі монети та актуальну ціну\n' +
      '  Керувати своєю колекцією\n\n' +
      'Спробуйте: <code>/search 1 гривня</code>',
    {
      parse_mode: 'HTML',
      reply_markup: getMainKeyboard(),
    },
  );
}

module.exports = { handleStart };
