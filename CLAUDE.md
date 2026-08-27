# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (long-polling, loads .env.development)
npm run dev

# Production webhook server (loads .env.production)
npm start

# Lint & format (Biome handles both)
npx biome lint .
npx biome format --write .

# Tests
npx jest
npx jest tests/edgeCases.test.js   # single file
```

## Architecture

Telegram bot for a Ukrainian numismatic (coin) catalogue backed by a WordPress GraphQL API (WPGraphQL + JWT auth).

**Entry points:**
- `index.js` — long-polling (local development)
- `server.js` — Express webhook server (production); listens on `PORT` (default `3001`), exposes `POST /webhook` and `GET /health`
- `app/setupBot.js` — registers all handlers; shared by both entry points

**Request flow:**

```
User message/callback
  → index.js (polling) / server.js (webhook)
    → app/setupBot.js
      → app/commands/start.js       /start
      → app/commands/search.js      /search <query>  → app/api.js
      → app/commands/collection.js  /collection      → app/withAuth.js → app/api.js
      → app/commands/login.js       /login, /logout, register, forgot password
      → app/handlers/callbacks.js   coin_<id> / add_<id> / gallery_<id> / chart_<id> → app/api.js
```

**`app/api.js`** — all GraphQL calls via native `fetch` (Node 22+):
- `searchCoins(query)`
- `getPriceHistory(coinId)` / `getCoinGallery(coinId)` / `getCoinDetails(coinId)`
- `loginUser(username, password)` → `{ authToken, refreshToken }`
- `registerUser(username, email, password)` — WPGraphQL core `registerUser` mutation
- `sendPasswordResetEmail(usernameOrEmail)` — WPGraphQL core `sendPasswordResetEmail`; always "succeeds" (backend obfuscates account existence to prevent enumeration)
- `resetUserPassword(key, login, password)` — WPGraphQL core `resetUserPassword`; `key`/`login` come from the reset link WordPress emails the user
- `logoutUser(authToken)` / `refreshAuthToken(refreshToken)`
- `getCollection(authToken)` / `addToCollection(coinId, authToken)`

`API_BASE_URL` is the GraphQL endpoint (`https://coins.cybers.pro/graphql`).

**`app/withAuth.js`** — wraps authenticated API calls; on JWT expiry retries once after refreshing `authToken` via `refreshToken` from session.

**`app/session.js`** — in-memory `Map` keyed by Telegram `userId`: `{ state, username, authToken, refreshToken, ... }`. Lost on process restart.

**`app/commands/login.js`** — a single text-message state machine (`handleAuthMessage`, intercepted in `bot.on('message:text', ...)` before falling back to search) drives three flows via `session.state`:
- Login: `awaiting_username` → `awaiting_password` → `loginUser()`
- Register (button "📝 Зареєструватися"): `awaiting_reg_username` → `awaiting_reg_email` → `awaiting_reg_password` → `registerUser()`, then auto `loginUser()` with the same credentials
- Forgot password (button "❓ Забули пароль?"): `awaiting_reset_identifier` → `sendPasswordResetEmail()` → `awaiting_reset_link` (user pastes the full reset link WordPress emailed them; `parseResetLink()` regexes out `key`/`login` from the query string — `login` is `rawurlencode()`d server-side, hence `decodeURIComponent()`) → `awaiting_reset_password` → `resetUserPassword()`, then auto `loginUser()`

Registration requires the WordPress `users_can_register` option to be enabled (Settings → General → Membership), otherwise `registerUser` throws `User registration is currently not allowed.` — the error message is passed straight through to the user.

Password reset emails a WordPress-generated link pointing at `wp-login.php?action=rp&key=...&login=...` on the wp-coins site itself — the bot doesn't intercept the email, it just parses that link back out of whatever the user pastes. There's no in-bot way to customize that email's wording without a wp-coins-side change (the `retrieve_password_message` filter).

**`app/handlers/callbacks.js`** — callback-query handlers:
- `coin_(\d+)`: price history + collection status → coin card message
- `add_(\d+)`: add to collection, edits existing message in-place
- `gallery_(\d+)`: sends up to 5 photos as media group
- `chart_(\d+)`: renders `getPriceHistory` as a line chart via `app/chart.js` (QuickChart.io short-URL API) and sends it as a photo

## Environment variables

| Variable | Description |
|---|---|
| `BOT_TOKEN` | Telegram bot token |
| `API_BASE_URL` | WPGraphQL endpoint |

Copy `.env.example` to `.env.development` for local dev.

## Production deployment (nginx + pm2)

The bot runs as a webhook behind nginx on a dedicated subdomain.

```bash
# On the server — copy nginx config and get SSL cert
sudo cp nginx.bot.conf /etc/nginx/sites-available/bot.coins.cybers.pro
sudo ln -s /etc/nginx/sites-available/bot.coins.cybers.pro /etc/nginx/sites-enabled/
sudo certbot --nginx -d bot.coins.cybers.pro
sudo nginx -t && sudo nginx -s reload

# Start bot process
pm2 start server.js --name coin-bot

# Register webhook with Telegram (once)
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://bot.coins.cybers.pro/webhook"
```

nginx config is in `nginx.bot.conf` — proxies `bot.coins.cybers.pro` → `localhost:3001`.

## Code style

- CommonJS (`require`/`module.exports`), no ESM
- Single quotes, 2-space indent, trailing commas, semicolons (enforced by Biome)
- `parse_mode: 'HTML'` throughout — use `escapeHtml()` from `app/utils.js` before interpolating any user/API data
- User-facing messages are in Ukrainian
- Node.js 22 required