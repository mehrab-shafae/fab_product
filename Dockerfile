FROM node:22-alpine

WORKDIR /app

COPY package.json ./

RUN npm install \
    && npm install typescript -g

COPY . .

RUN tsc

EXPOSE 7011 7021 7004

ENTRYPOINT ["sh", "-c"]
CMD ["node . & npm run start:minio & wait"]