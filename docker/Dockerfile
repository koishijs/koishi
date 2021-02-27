FROM node:lts-alpine
LABEL maintainer="NN708"

WORKDIR /app
COPY package.json ./
RUN npm i koishi

CMD [ "npx", "koishi", "start" ]