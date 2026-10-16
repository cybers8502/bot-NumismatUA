# Нумізматичний каталог — Telegram-бот

Telegram-бот для перегляду каталогу українських монет, актуальних цін та керування особистою колекцією. Дані надходять з WordPress GraphQL API (WPGraphQL + JWT).

## Функціонал

- `/search <назва>` — пошук монет за назвою
- `/app` — відкрити Mini App r-numismat (потрібен `WEBAPP_URL`)
- `🖼 Фото` — перегляд галереї монети (до 5 фото)
- Картка монети — назва, остання відома ціна з датою
- `/collection` — особиста колекція з кількістю та сплаченою сумою
- Додавання монети до колекції одним натисканням
- `/login` / logout — авторизація через WordPress JWT з авто-рефрешем токена

## Структура проекту

```
index.js              # Long-polling режим (локальна розробка)
functions.js          # Webhook режим — Firebase Cloud Functions (продакшн)
app/
  setupBot.js         # Реєстрація всіх хендлерів (single source of truth)
  api.js              # Всі GraphQL запити до WordPress
  session.js          # In-memory сесії: authToken, refreshToken
  withAuth.js         # Авто-рефреш JWT при закінченні терміну дії
  utils.js            # escapeHtml
  commands/
    start.js          # /start
    search.js         # /search — пошук + кнопки "Фото"
    collection.js     # /collection
    login.js          # /login, logout callback
  handlers/
    callbacks.js      # coin_<id>, add_<id>, gallery_<id>
```

### Авторизація (JWT)

1. `/login` → вводиш логін і пароль WordPress
2. GraphQL mutation `login` → `authToken` + `refreshToken`
3. Токени в пам'яті (втрачаються при cold start Cloud Functions — треба логінитись знову)
4. `withAuth` автоматично рефрешить `authToken` при протуханні через `refreshJwtAuthToken`
5. Logout інвалідує токен на сервері через mutation `logout`

## Локальна розробка

```bash
cp .env.example .env.development
# заповни BOT_TOKEN та API_BASE_URL
npm install
npm run dev
```

## Деплой на Firebase Cloud Functions

### Вимоги

- Node.js 22+
- `npm install -g firebase-tools` + `firebase login`

### 1. Секрети (Secret Manager)

```bash
firebase functions:secrets:set BOT_TOKEN --project numismat-8502
```

### 2. Змінні середовища

Створи `.env.numismat-8502` (не комітити):

```
API_BASE_URL=https://coins.cybers.pro/graphql
```

### 3. Деплой

```bash
npm run deploy
```

Функція деплоїться в регіон `europe-west3`.

### 4. Webhook (один раз після першого деплою)

```
https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://europe-west3-numismat-8502.cloudfunctions.net/numismatWebhook
```

### Корисні команди

```bash
firebase functions:list --project numismat-8502
firebase functions:log --only numismatWebhook --project numismat-8502
```

## Змінні середовища

| Змінна | Опис |
|---|---|
| `BOT_TOKEN` | Telegram bot token (Secret Manager у продакшні) |
| `API_BASE_URL` | WPGraphQL endpoint, напр. `https://coins.cybers.pro/graphql` |