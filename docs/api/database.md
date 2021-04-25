---
sidebarDepth: 2
---

# 数据库 (Database)

## 数据类型

### User

- **id:** `string` 内部编号
- **name:** `string` 用户昵称
- **flag:** `number` 状态标签
- **authority:** `number` 用户权限
- **usage:** `Record<string, number>` 指令调用次数
- **timers:** `Record<string, number>` 指令调用时间

### Channel

- **id:** `string` 频道标识符
- **flag:** `number` 状态标签
- **assignee:** `string` 代理者

## 全局接口

### User.Flag, Channel.Flag

所有用户 / 频道状态标签构成的枚举类型。参见 [状态标签](../guide/manage.md#状态标签)。

### User.fields, Channel.fields

所有用户 / 频道字段构成的列表。

### User.extend(getter), Channel.extend(getter)

- **getter:** `(type: string, id: string) => object` 新字段的初始化函数，返回值应该是一个由要扩展的字段和它们的默认值构成的键值对
- 返回值: `void`

扩展用户 / 频道字段。

### User.create(type, id), Channel.create(type, id)

- **type:** `string` 平台名
- **id:** `string` 用户 / 频道标识符
- 返回值: `User` / `Channel`

创建一个新用户 / 频道数据对象。

### Database.extend(database, extension)

- **database:** `string | (new () => Database)` 要扩展的数据库类；如果传入一个字符串，则会将这个模块的默认导出作为目标类
- **extension:** `Partial<Database>` 要添加到原型链的方法

扩展一个数据库的方法。

## 数据库对象

一个 Database 对象代理了 Koishi 上下文绑定的应用实例有关的所有数据库访问。同时它具有注入特性，任何插件都可以自己定义数据库上的方法。本章主要介绍数据库的官方接口。注意：**它们并不由 Koishi 自身实现，而是由每个数据库分别实现的**。Koishi 只是提供了一套标准。

### db.getUser(type, id, fields?)

- **type:** `string` 平台名
- **id:** `string | string[]` 用户标识符
- **fields:** `User.Field[]` 请求的字段，默认为全部字段
- 返回值: `Promise<User | User[]>` 用户数据

向数据库请求用户数据。如果传入的 id 是一个列表，则返回值也应当是一个列表。

::: tip 提示
尽管这里我们提供了 `fields` 参数用于对特定的数据库进行优化，但是如果你是数据库开发者，也完全可以忽略这个参数。只需要保证返回的数据满足用户数据格式，且包含在 `fields` 中的字段都存在即可。
:::

### db.setUser(type, id, data)
### db.createUser(type, id, data)

- **type:** `string` 平台名
- **id:** `string` 用户标识符
- **data:** `User` 要修改 / 添加的数据
- 返回值: `Promise<void>`

向数据库修改 / 添加用户数据。

### db.getChannel(type, id, fields?)

- **type:** `string` 平台名
- **id:** `string | string[]` 频道标识符
- **fields:** `ChannelField[]` 请求的字段，默认为全部字段
- 返回值: `Promise<Channel | Channel[]>` 频道数据

向数据库请求频道数据。如果传入的 id 是一个列表，则返回值也应当是一个列表。

### db.getChannelList(fields?, type?, assignees?)

- **fields:** `ChannelField[]` 请求的字段，默认为全部字段
- **type:** `string` 平台名，默认为全平台
- **assignees:** `string[]` 代理者列表，默认为当前运行的全部机器人
- 返回值: `Promise<Channel[]>` 频道数据列表

向数据库请求被特定机器人管理的所有频道数据。这里的两个参数可以写任意一个，都可以识别。

### db.setChannel(type, id, data)
### db.createChannel(type, id, data)

- **type:** `string` 平台名
- **id:** `number` 频道标识符
- **data:** `Channel` 要修改 / 添加的数据
- 返回值: `Promise<void>`

向数据库修改 / 添加频道数据。
