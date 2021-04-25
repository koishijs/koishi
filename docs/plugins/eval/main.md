---
sidebarDepth: 2
---

# 主线程 API

## 生命周期事件

### eval/before-start

- **触发方式:** parallel

即将启动子线程之前触发。

### eval/start

- **response**: `WorkerResponse` 子线程的 [response](./worker.md#response) 对象
- **触发方式:** parallel

子线程成功启动并完成初始化之后触发。

### eval/before-send

- **content:** `string` 要发送的内容
- **session:** `Session` 当前会话
- **触发方式:** waterfall

在子线程中调用 `main.send()`，主线程实际发送消息之前触发。你可以在这里修改 `content` 的值并返回。

## Trap 实例方法

### trap.define(key, decl)

- **key:** `string` 字段名
- **decl:** `Declaraion` 陷阱的定义
  - **decl.fields:** `Iterable<string>` 依赖的字段
  - **decl.get?:** `(target: {}) => any` 陷阱的 getter
  - **decl.set?:** `(target: {}, value: any) => void` 陷阱的 setter

定义一个陷阱字段。

### trap.fields(fields)

- **fields:** `Iterable<string>` 需要的字段

根据陷阱所需的字段生成实际数据所需的字段。

### trap.get(target, fields)

- **target:** `Observed<{}>` 目标对象
- **fields:** `Iterable<string>` 需要的字段

根据需要的字段生成一个陷阱对象。

### trap.set(target, data)

- **target:** `Observed<{}>` 目标对象
- **data:** `object` 需要更新的数据

根据给定的数据更新目标对象。

## Trap 静态属性

### 访问配置格式

这个数据类型将被用于 [`userFields`](./config.md#userfield) 等配置项，以及扩展功能的 manifest.yml 中。其中 readable 表示可读的字段，writable 表示可写的字段。如果直接传入一个数组，则表示所有这些字段都是只读的。

```js
export interface AccessObject<T> {
  readable?: T[]
  writable?: T[]
}

export type Access<T> = T[] | AccessObject<T>
```

### Trap.user

- 类型: `Trap`

代理用户数据的陷阱对象。

### Trap.channel

- 类型: `Trap`

代理频道数据的陷阱对象。

### Trap.resolve(fields)

- **fields:** `Access<T>` 访问配置
- 返回值: `AccessObject<T>`

将一个一般形式的访问配置转化为对象格式的。

### Trap.merge(baseAccess, fields)

- **baseAccess:** `AccessObject<T>` 访问配置
- **fields:** `Access<T>` 访问配置
- 返回值: `AccessObject<T>`

以 baseAccess 为基础，合并另一个访问配置，返回一个新的对象格式访问配置。

### Trap.action(command, userAccess, channelAccess, action)

- **command:** `Command` 指令
- **userAccess:** `AccessObject<User.Field>` 用户数据访问配置
- **channelAccess:** `AccessObject<Channel.Field>` 频道数据访问配置
- **action:** `Command.Action` 回调函数

以用户和频道数据的陷阱对象为基础，添加一个用于子线程的指令回调函数。其参数 `argv` 附加了一个额外的属性：

- **argv.payload:** `SessionData` 会话信息，可用于子线程中的 [`createSession()`](./worker.md#createsession) 方法

## MainHandle

### handle.execute(uuid, content)

- **uuid:** `string` 会话 UUID
- **content:** `string` 要执行的指令

在 uuid 相对应的会话中触发指令。

### handle.send(uuid, content)

- **uuid:** `string` 会话 UUID
- **content:** `string` 要发送的文本

在 uuid 相对应的会话中发送消息。

### handle.updateUser(uuid, data)

- **uuid:** `string` 会话 UUID
- **data:** `Partial<User>` 要更新的用户数据

在 uuid 相对应的会话中更新用户数据。

### handle.updateChannel(uuid, data)

- **uuid:** `string` 会话 UUID
- **data:** `Partial<Channel>` 要更新的频道数据

在 uuid 相对应的会话中更新频道数据。

## EvalWorker

### worker.remote

- 类型: [`WorkerHandle`](./worker.md#workerhandle)

子线程 WorkerHandle 对象的代理。Koishi 的内部机制将允许你如同直接在子线程里调用 WorkerHandle 方法那样调用这里的 `remote` 对象。当然你只能通过 `remote` 做到这件事。

### worker.state

- 类型: `number`

子线程的运行状态。分别用 0, 1, 2, 3 表示 closing, close, opening, open。

### worker.start()

- 返回值: `Promise<void>`

启动子线程。

### worker.stop()

- 返回值: `Promise<void>`

关闭子线程。

### worker.restart()

- 返回值: `Promise<void>`

关闭并重新启动子线程。
