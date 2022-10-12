FROM node:lts-alpine
LABEL maintainer="NN708"

RUN yarn create koishi koishi-app -y && cd koishi-app && \
    sed -i 's/host: .*/host: 0.0.0.0/g' koishi.yml && \
    yarn install

WORKDIR /koishi-app

ENTRYPOINT [ "yarn", "start" ]
