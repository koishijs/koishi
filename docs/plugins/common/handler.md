---
sidebarDepth: 2
---

# 处理事件

## 处理好友和群申请

当使用了 koishi-plugin-common 并配置了数据库时，默认情况下 Koishi 会通过所有 1 级以上用户的好友申请，忽略所有群申请。你可以手动设置忽略和通过的函数：

```js koishi.config.js
module.exports = {
  plugins: {
    common: {
      onFriendRequest: true, // 通过所有好友申请
      onGroupMemberRequest: undefined, // 忽略所有加群申请（当然这没必要写出来）
      async onGroupRequest(session) {
        // 拒绝所有来自 1 级以下，通过所有来自 3 级或以上权限用户的加群邀请，其他不处理
        const user = await session.observeUser(['authority'])
        if (user.authority >= 3) {
          return true
        } else if (user.authority <= 1) {
          return false
        }
      },
    },
  },
}
```

在上面的例子中，`onFriendRequest`, `onGroupMemberRequest` 和 `onGroupRequest` 分别用于处理好友申请，加群申请和加群邀请。每个选项的值都可以是下面几种类型：

- true: 表示通过申请
- false: 表示拒绝申请
- undefined: 表示不做处理
- 字符串
  - 如果是好友申请，则表示通过，并使用该字符串作为该好友的备注名
  - 如果是加群申请或邀请，则表示拒绝，并使用该字符串作为拒绝的理由
- 函数
  - 传入两个参数，第一个是请求对应的 Session 对象，第二个是所在的 App 实例
  - 返回值同样可以是 true, false, undefined, 字符串或对应的 Promise，将按照上面所说的方式来解读

## 配置内置问答

respondent 插件允许设置一套内置问答，就像这样：

```js koishi.config.js
module.exports = {
  plugins: {
    common: {
      respondent: [{
        match: 'awsl',
        reply: '爱我苏联',
      }, {
        match: /^\s*(\S +){2,}\S\s*$/,
        reply: '空格警察，出动！',
      }, {
        match: /^(.+)一时爽$/,
        reply: (_, str) => `一直${str}一直爽`,
      }],
    },
  },
}
```

<panel-view :messages="[
  ['Alice', 'awsl'],
  ['Koishi', '爱我苏联'],
  ['Bob', '久 等 了'],
  ['Koishi', '空格警察，出动！'],
  ['Carol', '挖坑一时爽'],
  ['Koishi', '一直挖坑一直爽'],
]"/>

其中 `match` 可以是一个字符串或正则表达式，用来表示要匹配的内容；`reply` 可以是一个字符串或传入字符串的函数，用来表示输出的结果。`respondent` 数组会按照从上到下的顺序进行匹配。

如果想要加入更高级和用户可定义的问答系统，可以参见 [koishi-plugin-teach](../teach.md)。

## 跨频道消息转发

koishi-plugin-common 也支持在不同的频道之间转发消息。

```js koishi.config.js
module.exports = {
  plugins: {
    common: {
      relay: [{
        // 请使用 {platform}:{channelId} 的格式
        source: 'onebot:123456789',
        destination: 'discord:987654321',
      }],
    },
  },
}
```

当用户 Alice 在频道 `source` 中发送消息 foo 的时候，koishi 就会在频道 `destination` 中发送如下的内容。接着，频道 `destination` 中的用户 Bob 也可以通过引用回复这条消息的方式将自己想说的话发回到频道 `source` 中去。

<panel-view title="聊天记录">
<chat-message nickname="Koishi" avatar="/koishi.png">
<p>Alice: foo</p>
</chat-message>
<chat-message nickname="Bob" color="#00994d">
<blockquote><p>Alice: foo</p></blockquote>
<p>bar</p>
</chat-message>
</panel-view>
