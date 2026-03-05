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
```

## Architecture

The app is a Telegram bot for a Ukrainian numismatic (coin) catalogue backed by a WordPress REST API.

**Entry point:** `index.js` — creates a grammY `Bot`, registers command and callback-query handlers, starts long-polling.

**Request flow:**

```
User message/callback
  → index.js  (registers handlers)
    → app/commands/start.js     /start
    → app/commands/search.js    /search <query>  →  app/api.js → WP REST API
    → app/handlers/callbacks.js coin_<id> / add_<id>  →  app/api.js → custom WP API
```

**`app/api.js`** — all HTTP calls (native `fetch`, Node 20+):
- `searchCoins(query)` — `GET /wp/v2/coins?search=...&per_page=5` (standard WP REST)
- `getPriceHistory(coinId)` — `GET {API_BASE}/coins/{id}/price-history`
- `getCollection()` — `GET {API_BASE}/collection` (Basic Auth)
- `addToCollection(coinId)` — `POST {API_BASE}/collection` (Basic Auth)

`API_BASE_URL` points to the custom namespace (`/wp-json/coins/v1`). The standard WP REST base (`/wp-json/wp/v2`) is derived by stripping `/coins/v1` from it.

**`app/handlers/callbacks.js`** — two callback-query handlers matched by regex:
- `coin_(\d+)`: fetches price history and collection status in parallel try/catch blocks, replies with a new coin-card message. The coin title is extracted from the clicked button's text in the search results keyboard.
- `add_(\d+)`: POSTs to collection, then edits the coin-card message in-place (falls back to a new reply if the message is too old to edit).

## Environment variables

| Variable | Description |
|---|---|
| `BOT_TOKEN` | Telegram bot token |
| `API_BASE_URL` | Custom WP REST namespace, e.g. `https://coins.cybers.pro/wp-json/coins/v1` |
| `WP_USERNAME` | WordPress username for Basic Auth |
| `WP_APP_PASSWORD` | WordPress Application Password for Basic Auth |

See `.env.example` for the template.

## Code style

- CommonJS (`require`/`module.exports`), no ESM
- Single quotes, 2-space indent, trailing commas, semicolons (enforced by Biome)
- `parse_mode: 'HTML'` throughout — use `escapeHtml()` from the relevant module before interpolating user/API data
- User-facing messages are in Ukrainian
- Node.js 20 required (see `.nvmrc`)