---
sidebarDepth: 2
---

# 提供网络服务

`ctx.router` 是 Koishi 的内置服务，提供了一个基于 [Koa Router](https://github.com/koajs/router) 的简单路由系统，用于管理 Koishi 应用收到的网络请求。除了 Koa Router 所支持的方法外，Router API 还提供了一些额外的功能，例如支持接受 WebSocket 连接等。

::: tip
Koishi 默认情况下并不会监听任何端口，如要启用网络服务请记得配置 [`options.port`](../../api/core/app.md#options-port)。
:::

## 实例方法

### router[method](path, middleware)

- **method:** 可以是 `GET`, `POST`, `PUT`, `DELETE`, `PATCH` 或 `ALL`
- **path:** `string | RegExp | (string | RegExp)[]` 路径
- **middleware:** `Function` Koa 中间件

处理特定路径上的网络请求。具体请参见 [这里](https://github.com/koajs/router/blob/master/API.md)。

### router.ws(path, handler)

- **path:** `string | RegExp | (string | RegExp)[]` 路径
- **handler:** `WebSocketHandler` 处理函数，接受下列参数
  - **socket:** [`WebSocket`](https://github.com/websockets/ws/blob/master/doc/ws.md#class-websocket) WebSocket 连接
  - **request:** [`IncomingMessage`](https://nodejs.org/api/http.html#class-httpincomingmessage) 网络请求

在给定的路径上支持 WebSocket 连接。

### 副作用处理

我们在扩展了 Koa Router 的同时，对于其常用方法也支持了自动的副作用处理。当一个插件被卸载时，其上注册的路由也将同时被删除。不过在使用时也会有一些限制。部分方法会影响其他插件上下文或不支持副作用处理，因此请避免使用：

- router.param()
- router.prefix()
