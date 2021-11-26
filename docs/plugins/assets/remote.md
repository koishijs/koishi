---
title: 资源存储：Remote
sidebarDepth: 2
---

# @koishijs/plugin-assets-remote

如果你同时在多台机器上运行了 Koishi（比如一个用于开发，另一个用于生产），同时你又希望把两边的资源文件存放在一起，这个插件同样可以做到！你只需要首先生产环境配置本地存储，同时在开发环境编写下面的配置，即可实现所有的资源文件都统一存放在生产环境的本地目录。

## 配置项

### endpoint

- 类型: `string`

远程服务器地址。

### secret

- 类型: `string`

服务器设置的密钥，配合 assets-local 使用。
