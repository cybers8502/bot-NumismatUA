# Нумізматичний каталог — Telegram-бот

Telegram-бот для перегляду каталогу українських монет, актуальних цін та керування особистою колекцією. Дані надходять з WordPress GraphQL API.

## Функціонал

- `/search <назва>` — пошук монет за назвою (до 5 результатів)
- Картка монети — назва, остання відома ціна з датою
- Перевірка наявності монети у власній колекції
- Додавання монети до колекції одним натисканням

## Структура проекту

```
index.js              # Long-polling режим (локальна розробка)
functions.js          # Webhook режим — точка входу для Firebase Cloud Functions
server.js             # Webhook режим — Express-сервер для прямого Cloud Run
app/
  api.js              # Всі HTTP-запити до WordPress GraphQL API
  commands/
    start.js          # /start
    search.js         # /search <назва>
  handlers/
    callbacks.js      # Inline-кнопки: картка монети, додавання до колекції
```

## Локальна розробка

Скопіюй `.env.example` у `.env.development` та заповни:

```
BOT_TOKEN=          # Токен Telegram-бота (BotFather)
API_BASE_URL=       # GraphQL endpoint, наприклад https://coins.cybers.pro/graphql
WP_USERNAME=        # Логін WordPress
WP_APP_PASSWORD=    # WordPress Application Password
```

```bash
npm install
npm run dev       # long-polling, завантажує .env.development
```

## Деплой на Firebase Cloud Functions

### Вимоги

- Node.js 20+
- `npm install -g firebase-tools`
- Авторизація: `firebase login`

### 1. Налаштування проекту

У `.firebaserc` вже вказано проект `my-budget-eb39d`.

Створи файл `.env.my-budget-eb39d` (не комітити в git):

```
API_BASE_URL=https://coins.cybers.pro/graphql
WP_USERNAME=your_wordpress_username
```

### 2. Встановити секрети (Secret Manager)

```bash
firebase functions:secrets:set BOT_TOKEN --project my-budget-eb39d
firebase functions:secrets:set WP_APP_PASSWORD --project my-budget-eb39d
```

### 3. Деплой

```bash
firebase deploy --only functions:numismatWebhook --project my-budget-eb39d
```

Функція деплоїться в регіон `europe-west3`. Прапор `--only functions:numismatWebhook` гарантує, що інші функції на проекті не чіпаються.

### 4. Встановити webhook

Після деплою один раз виконати:

```
https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://europe-west3-my-budget-eb39d.cloudfunctions.net/numismatWebhook
```

### Корисні команди

```bash
firebase functions:list --project my-budget-eb39d          # переглянути задеплоєні функції
firebase functions:delete numismatWebhook --region europe-west3 --project my-budget-eb39d --force
firebase functions:log --only numismatWebhook --project my-budget-eb39d
```