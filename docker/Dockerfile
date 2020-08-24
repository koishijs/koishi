FROM node:lts-alpine

EXPOSE 8080
VOLUME [ "/config" ]

WORKDIR /config
RUN npm i koishi -g
COPY ./start.js /utilities/start.js

CMD [ "node", "/utilities/start.js" ]