---
title: 资源存储：Remote
sidebarDepth: 2
---

# @koishijs/plugin-assets-remote

## 使用远程服务器存储

如果你同时在多台机器上运行了 Koishi（比如一个用于开发，另一个用于生产），同时你又希望把两边的资源文件存放在一起，这个插件同样可以做到！你只需要首先生产环境配置本地存储，同时在开发环境编写下面的配置，即可实现所有的资源文件都统一存放在生产环境的本地目录。

```js koishi.config.js
module.exports = {
  plugins: {
    assets: {
      type: 'remote',
      // 服务器地址
      server: '',
      // 服务器设置的密钥
      secret: '',
    },
  },
}
```

## 使用 SM.MS 存储

[sm.ms](https://sm.ms/) 是一个免费图床服务，可以用来存储 Koishi 接收到的静态资源文件。

```js koishi.config.js
module.exports = {
  plugins: {
    assets: {
      type: 'smms',
      // sm.ms 的访问令牌
      token: '',
    },
  },
}
```
