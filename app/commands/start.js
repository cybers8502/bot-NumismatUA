'use strict';

async function handleStart(ctx) {
  await ctx.reply(
    '<b>Вітаю у нумізматичному каталозі!</b>\n\n' +
      'Я допоможу вам:\n' +
      '  <b>/search &lt;назва&gt;</b> — знайти монету за назвою\n' +
      '  Переглянути деталі монети та актуальну ціну\n' +
      '  Керувати своєю колекцією\n\n' +
      'Спробуйте: <code>/search 1 гривня</code>',
    { parse_mode: 'HTML' },
  );
}

module.exports = { handleStart };