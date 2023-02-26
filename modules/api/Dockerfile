FROM node:16.19.0-alpine3.17

ENV PORT 80

WORKDIR /app

COPY package.json package.json
COPY package-lock.json package-lock.json

RUN npm install --omit=dev

COPY src/ .

EXPOSE 80

CMD ["node", "index.js"]