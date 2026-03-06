FROM node:22-jammy

WORKDIR /usr/src/app

COPY package*.json ./
ENV HUSKY=0
RUN npm ci --omit=dev

COPY . .

CMD ["node", "index.js"]
