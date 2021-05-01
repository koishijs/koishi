---
sidebarDepth: 2
---

# 使用 Docker

Koishi 提供了一个 Docker 镜像，方便你在 Docker 容器中运行 Koishi。你需要首先安装 [Docker](https://www.docker.com) 来运行 Docker 镜像。

## 拉取镜像

你可以从 Docker Hub 拉取最新的 Koishi 镜像：

```cli
docker pull koishijs/koishi:latest
```

## 启动容器

Koishi 的 Docker 镜像需要挂载配置文件 `koishi.config.js` 才能运行。在适配器和插件还没有安装时，你可以先创建如下的配置文件来确保容器能够正确启动：

```js koishi.config.js
module.exports = {
  bots: [],
}
```

完成之后，挂载 `koishi.config.js` 并启动容器：

```cli
docker run -d --name koishi \
  -v $PWD/koishi.config.js:/app/koishi.config.js \
  koishijs/koishi:latest
```

## 安装适配器和插件

在容器正常运行时，输入以下的命令行进入容器：

```cli
docker exec -it koishi sh
```

在容器内，你可以安装所需要的插件（这里以 koishi-adapter-onebot 和 koishi-plugin-common 为例）：

```cli
# 安装插件
npm i koishi-adapter-onebot koishi-plugin-common

# 退出容器
exit
```

修改配置文件以启用这些插件：

```js koishi.config.js
module.exports = {
  // 协议类型
  type: 'onebot:http',
  // 机器人自己的账号
  selfId: 123456789,
  // 插件列表
  plugins: {
    common: {},
  },
}
```

最后重新启动容器：

```cli
docker restart koishi
```

## 使用 Docker Compose

TODO