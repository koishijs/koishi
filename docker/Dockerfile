FROM node:lts-alpine
LABEL maintainer="NN708"

RUN yarn create koishi koishi-app -y && cd koishi-app && \
    sed -i '1 ihost: 0.0.0.0' koishi.yml && \
    yarn install

WORKDIR /koishi-app

ENTRYPOINT [ "yarn", "start" ]
