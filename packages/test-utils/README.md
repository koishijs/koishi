# koishi-test-utils
 
[![Status](https://img.shields.io/github/workflow/status/koishijs/koishi/CI/master?style=flat-square)](https://github.com/koishijs/koishi/actions?query=workflow:CI)
[![npm](https://img.shields.io/npm/v/koishi-test-utils?style=flat-square)](https://www.npmjs.com/package/koishi-test-utils)

面向 [Koishi](https://www.npmjs.com/package/koishi) 的测试工具。

## [API 文档](https://koishijs.github.io/api/test-utils.html)

### testDatabase(options, hooks)

测试全部内置数据库方法。

- **options:** `AppOptions` App 的构造函数选项，参见 [配置列表](../guide/config-file.md#配置列表)
- **hooks:** `TestDatabaseOptions` 测试中执行的钩子函数
- 返回值: [`App`](./app.md) 用于测试的 App 实例

```ts
type TestHook = (app: App) => any

export interface TestDatabaseOptions {
  beforeEachUser?: TestHook
  afterEachUser?: TestHook
  beforeEachGroup?: TestHook
  afterEachGroup?: TestHook
}
```

### registerMemoryDatabase(name?: string)

注册内存数据库。参见 [模拟数据库](../guide/unit-tests.md#模拟数据库)。

- **name:** `string` 要注册的数据库的名字，默认为 `memory`
- 返回值: `void`

### 会话 (Session)

#### new Session(app, type, userId, ctxId?)

创建一个新的会话对象。

- **app:** [`App`](./app.md) 绑定的 App 实例
- **type:** `'user' | 'group' | 'discuss'` 上下文类型
- **userId:** `number` 发言用户 ID
- **ctxId:** `number` 群号或讨论组号（如果是私聊则不需要）

#### ses.shouldHaveReply(message, reply?)

断言某条信息应存在某些回复。

- **message:** `string` 要发送给机器人的信息
- **reply:** `string` 应有的回复，如果略去则不会进行比较
- 返回值: `Promise<void>`

#### ses.shouldMatchSnapshot(message)

断言某条信息应存在与快照一致的回复。

- **message:** `string` 要发送给机器人的信息
- 返回值: `Promise<void>`

#### ses.shouldHaveNoResponse(message)

断言某条信息不应存在任何回复。

- **message:** `string` 要发送给机器人的信息
- 返回值: `Promise<void>`
