'use strict';

// HTTP server for Cloud Run (webhook mode).
// Local development uses index.js (long-polling).

const express = require('express');
const { telegramWebhook } = require('./functions');

const app = express();
app.use(express.json());
app.post('/', telegramWebhook);

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`Listening on port ${port}`));