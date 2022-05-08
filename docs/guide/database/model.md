---
sidebarDepth: 2
---

# 扩展数据模型

如果你的插件需要声明新的字段或者表，你可以通过 `ctx.model` 来对数据模型进行扩展。请注意，数据模型的扩展一定要在使用前完成，不然后续数据库操作可能会失败。

## 扩展字段

向内置的 User 表中注入字段的方式如下：

```ts
// @errors: 1117
// TypeScript 用户需要进行类型合并
declare module 'koishi' {
  interface User {
    foo: string
  }
}

ctx.model.extend('user', {
  // 向用户表中注入字符串字段 foo
  foo: 'string',
  // 你还可以配置默认值为 'bar'
  foo: { type: 'string', initial: 'bar' },
})
```

向 Channel 注入字段同理。

## 扩展表

利用 `ctx.model.extend()` 的第三个参数，我们就可以定义新的数据表了：

```ts
// @errors: 2440
// TypeScript 用户需要进行类型合并
declare module 'koishi' {
  interface Tables {
    schedule: Schedule
  }
}

export interface Schedule {
  id: number
  assignee: string
  time: Date
  lastCall: Date
  interval: number
  command: string
  session: Session.Payload
}

ctx.model.extend('schedule', {
  // 各字段类型
  id: 'unsigned',
  assignee: 'string',
  time: 'timestamp',
  lastCall: 'timestamp',
  interval: 'integer',
  command: 'text',
  session: 'json',
}, {
  // 使用自增的主键值
  autoInc: true,
})
```

## 创建索引

我们还可以为数据库声明索引：

```ts
declare module 'koishi' {
  interface Tables {
    foo: Foo
  }
}

interface Foo {
  name: string
  bar: string
  baz: string
  uid: string
}

// ---cut---
// 注意这里配置的是第三个参数，也就是之前 autoInc 所在的参数
ctx.model.extend('foo', {}, {
  // 主键，默认为 'id'
  // 主键将会被用于 Query 的简写形式，如果传入的是原始类型或数组则会自行理解成主键的值
  primary: 'name',
  // 唯一键，这应该是一个列表
  // 这个列表中的字段对应的值在创建和修改的时候都不允许与其他行重复
  unique: ['bar', 'baz'],
  // 外键，这应该是一个键值对
  foreign: {
    // 相当于约束了 foo.uid 必须是某一个 user.id
    uid: ['user', 'id'],
  },
})
```
