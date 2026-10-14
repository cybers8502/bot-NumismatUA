'use strict';

const { Keyboard } = require('grammy');

const BTN_SEARCH = '🔍 Пошук';
const BTN_COLLECTION = '📚 Моя колекція';
const BTN_LOGIN = '🔑 Авторизація';

/** Persistent bottom keyboard mirroring the command menu (the Mini App opens from the chat menu button). */
function getMainKeyboard() {
  return new Keyboard()
    .text(BTN_SEARCH)
    .text(BTN_COLLECTION)
    .row()
    .text(BTN_LOGIN)
    .persistent()
    .resized();
}

module.exports = { getMainKeyboard, BTN_SEARCH, BTN_COLLECTION, BTN_LOGIN };
