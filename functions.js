'use strict';

// Entry point for Firebase Cloud Functions (2nd gen) — webhook mode.
// Local development still uses index.js (long-polling).

const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret, defineString } = require('firebase-functions/params');
const { Bot, webhookCallback } = require('grammy');
const { handleStart } = require('./app/commands/start');
const { handleSearch } = require('./app/commands/search');
const {
  handleCoinCallback,
  handleAddCallback,
} = require('./app/handlers/callbacks');

const botToken = defineSecret('BOT_TOKEN');
const wpAppPassword = defineSecret('WP_APP_PASSWORD');
const apiBaseUrl = defineString('API_BASE_URL');
const wpUsername = defineString('WP_USERNAME');

// Lazy init: bot is created on first request so Firebase CLI can analyze
// the codebase without env vars being present.
let handler = null;

function getHandler() {
  if (!handler) {
    const bot = new Bot(botToken.value());
    bot.command('start', handleStart);
    bot.command('search', handleSearch);
    bot.callbackQuery(/^coin_(\d+)$/, handleCoinCallback);
    bot.callbackQuery(/^add_(\d+)$/, handleAddCallback);
    bot.catch((err) => {
      console.error('Bot error:', err.message, err.ctx?.update);
    });
    handler = webhookCallback(bot, 'express');
  }
  return handler;
}

exports.numismatWebhook = onRequest(
  {
    region: 'europe-west3',
    secrets: [botToken, wpAppPassword],
  },
  (req, res) => {
    // Expose plain env vars so app/api.js can read process.env as usual
    process.env.API_BASE_URL = apiBaseUrl.value();
    process.env.WP_USERNAME = wpUsername.value();
    process.env.WP_APP_PASSWORD = wpAppPassword.value();
    return getHandler()(req, res);
  },
);
