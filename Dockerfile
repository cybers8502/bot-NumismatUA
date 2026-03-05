# 1. Базовий Node образ
FROM node:20-slim

# 2. Встановлення Puppeteer залежностей
RUN apt-get update && apt-get install -y \
       chromium \
        fonts-liberation \
        libasound2 \
        libatk-bridge2.0-0 \
        libatk1.0-0 \
        libcups2 \
        libdbus-1-3 \
        libdrm2 \
        libgbm1 \
        libgtk-3-0 \
        libnspr4 \
        libnss3 \
        libx11-xcb1 \
        libxcomposite1 \
        libxdamage1 \
        libxfixes3 \
        libxrandr2 \
        libxss1 \
        libxtst6 \
        xdg-utils \
        ca-certificates \
      && rm -rf /var/lib/apt/lists/*

# Нерутовий користувач для Puppeteer
RUN groupadd -r pptr && useradd -m -r -g pptr -s /bin/bash pptruser \
 && mkdir -p /home/pptruser/.cache /usr/src/app /tmp/puppeteer \
 && chown -R pptruser:pptr /home/pptruser /usr/src/app /tmp/puppeteer

# 3. Робоча директорія
WORKDIR /usr/src/app

# 4. Копіювання package.json
COPY package*.json ./
# 5. Встановлення залежностей
ENV HUSKY=0
RUN npm ci --omit=dev

# 6. Копіювання решти коду
COPY . .

# 7. Встановлення Puppeteer Chrome шляхів
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_DOWNLOAD=true

# 8. Порт (Cloud Run використовує PORT)
ENV PORT=8080

# 9. Запуск застосунку
CMD ["npm", "start"]
