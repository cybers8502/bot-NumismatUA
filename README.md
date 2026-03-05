# Нумізматичний каталог — Telegram-бот

Telegram-бот для перегляду каталогу українських монет, актуальних цін та керування особистою колекцією. Дані надходять з WordPress REST API.

## Функціонал

- `/search <назва>` — пошук монет за назвою (до 5 результатів)
- Картка монети — назва, остання відома ціна з датою
- Перевірка наявності монети у власній колекції
- Додавання монети до колекції одним натисканням

## Структура проекту

```
index.js              # Точка входу — реєстрація хендлерів, запуск бота
app/
  api.js              # Всі HTTP-запити до WordPress REST API
  commands/
    start.js          # /start
    search.js         # /search <назва>
  handlers/
    callbacks.js      # Inline-кнопки: картка монети, додавання до колекції
```

## Налаштування

Скопіюй `.env.example` у `.env.development` та заповни:

```
BOT_TOKEN=          # Токен Telegram-бота (BotFather)
API_BASE_URL=       # Базовий URL кастомного WP REST API (наприклад https://coins.cybers.pro/wp-json/coins/v1)
WP_USERNAME=        # Логін WordPress
WP_APP_PASSWORD=    # WordPress Application Password
```

## Запуск

```bash
npm install
npm run dev     # розробка (завантажує .env.development)
npm start       # продакшн (завантажує .env.production)
```

## Вимоги

- Node.js 20+