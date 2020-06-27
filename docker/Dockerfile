FROM node:lts-alpine

WORKDIR /config
RUN npm i koishi -g

EXPOSE 8080
VOLUME [ "/config" ]

CMD [ "koishi", "run" ]