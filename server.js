'use strict';

require('dotenv').config({
  path: `.env.${process.env.NODE_ENV || 'production'}`,
});

const express = require('express');
const { Bot, webhookCallback } = require('grammy');
const { setupBot } = require('./app/setupBot');

const bot = new Bot(process.env.BOT_TOKEN);
setupBot(bot);

const app = express();
app.use(express.json());
app.get('/health', (_req, res) => res.send('ok'));
app.post('/webhook', webhookCallback(bot, 'express'));

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`Listening on port ${port}`));
