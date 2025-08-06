FROM node:lts-bookworm-slim

WORKDIR /app

COPY package.json ./

RUN npm install \
    && npm install typescript -g

COPY . .

COPY .env .env

RUN tsc

CMD ["npm", "start"]
