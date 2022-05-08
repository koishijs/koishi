---
sidebarDepth: 2
---

# 服务 (Service)

## 内置服务

下面的属性为了访问方便而绑定，严格上它们对一个 App 实例下的所有上下文都是相同的。

### ctx.bots

- 类型: [`Bot[]`](./bot.md)

一个保存了当前全部 Bot 的数组。

### ctx.database

- 类型: `Database`

当前应用的 [Database](./database.md#数据库对象) 对象。

### ctx.i18n

### ctx.model

### ctx.router

- 类型: `KoaRouter`

如果你配置了 [port](./app.md#option-port) 选项，则这个属性将作为一个 [KoaRouter](https://github.com/koajs/router/blob/master/API.md) 实例。你可以在上面自定义新的路由：

```ts
ctx.router.get('/path', (ctx, next) => {
  // handle request
})
```

## 服务：BotList

除了可以使用 `ctx.bot.forEach()` 这样的方法外，我们还提供了一些额外的接口：

#### ctx.bots.get(sid)

- **sid:** `string` 机器人的 sid
- 返回值: `Bot` 机器人实例

使用 sid 获取机器人实例。

#### ctx.bots.remove(id)

- **sid:** `string` 机器人的 id
- 返回值: `boolean` 机器人实例是否存在

移除一个机器人实例。

#### ctx.bots.create(platform, options, constructor?)

- **platform:** `string` 适配器名
- **options:** `object` 配置项
- **constructor:** `Function` 构造函数

新增一个机器人实例。

## 服务：Registry
