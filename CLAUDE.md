# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev          # Run with NODE_ENV=development (loads .env.development)
npm start            # Run with NODE_ENV=production (loads .env.production)

# Linting & formatting
npm run lint         # ESLint
npx biome format --write .  # Biome formatter (also runs automatically on pre-commit)

# Tests
npx jest            # Run all tests
npx jest tests/edgeCases.test.js  # Run a single test file

# Deploy
npm run deploy       # firebase deploy --only functions:numismatWebhook
```

## Architecture

The app is a Telegram bot for a Ukrainian numismatic (coin) catalogue backed by a WordPress GraphQL API (WPGraphQL + JWT auth).

**Entry points:**
- `index.js` — long-polling mode (local development)
- `functions.js` — Firebase Cloud Functions webhook (production)
- `app/setupBot.js` — registers all handlers on a bot instance (single source of truth for both entry points)

**Request flow:**

```
User message/callback
  → index.js / functions.js
    → app/setupBot.js
      → app/commands/start.js       /start
      → app/commands/search.js      /search <query>      → app/api.js
      → app/commands/collection.js  /collection          → app/withAuth.js → app/api.js
      → app/commands/login.js       /login, /logout
      → app/handlers/callbacks.js   coin_<id> / add_<id> / gallery_<id>  → app/api.js
```

**`app/api.js`** — all HTTP calls (native `fetch`, Node 22+):
- `searchCoins(query)` — GraphQL `coins(where:{search})` query
- `getPriceHistory(coinId)` — GraphQL `coin(id, idType:DATABASE_ID) { priceHistory }`
- `getCoinGallery(coinId)` — GraphQL `coin(id, idType:DATABASE_ID) { gallery { medium } }`
- `loginUser(username, password)` — GraphQL mutation `login` → `{ authToken, refreshToken }`
- `logoutUser(authToken)` — GraphQL mutation `logout`
- `refreshAuthToken(refreshToken)` — GraphQL mutation `refreshJwtAuthToken`
- `getCollection(authToken)` — GraphQL `myCollection` (Bearer auth)
- `addToCollection(coinId, authToken)` — GraphQL mutation `addToCollection` (Bearer auth)

`API_BASE_URL` is the GraphQL endpoint (e.g. `https://coins.cybers.pro/graphql`).

**`app/withAuth.js`** — wraps authenticated API calls with automatic JWT refresh on expiry. On auth error, uses `refreshToken` from session to get a new `authToken` and retries once.

**`app/session.js`** — in-memory `Map` keyed by Telegram `userId`:
- `{ state, username, authToken, refreshToken }`
- Session is lost on process restart (Cloud Functions cold start)

**`app/handlers/callbacks.js`** — three callback-query handlers:
- `coin_(\d+)`: fetches price history + collection status, replies with coin card
- `add_(\d+)`: adds coin to collection, edits coin-card message in-place
- `gallery_(\d+)`: fetches `gallery { medium }`, sends up to 5 photos as media group

## Environment variables

| Variable | Description |
|---|---|
| `BOT_TOKEN` | Telegram bot token |
| `API_BASE_URL` | WPGraphQL endpoint, e.g. `https://coins.cybers.pro/graphql` |

`BOT_TOKEN` is stored in Firebase Secret Manager for production.

## Code style

- CommonJS (`require`/`module.exports`), no ESM
- Single quotes, 2-space indent, trailing commas, semicolons (enforced by Biome)
- `parse_mode: 'HTML'` throughout — use `escapeHtml()` from `app/utils.js` before interpolating user/API data
- User-facing messages are in Ukrainian
- Node.js 22 required (see `engines.node` in `package.json`)