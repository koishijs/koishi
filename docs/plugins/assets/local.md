---
title: 资源存储：Local
sidebarDepth: 2
---

# @koishijs/plugin-assets-local

使用本地目录存放资源文件。

## 配置项

### root

- 类型: `string`

本地存储资源文件的绝对路径。

### path

- 类型: `string`
- 默认值: `'/files'`

静态图片暴露在服务器的路径。

### selfUrl

- 类型: `string`
- 默认值: `app.options.selfUrl`

Koishi 暴露在公网的地址。

### secret

- 类型: `string`

防止恶意上传的密钥，配合 assets-remote 使用。
