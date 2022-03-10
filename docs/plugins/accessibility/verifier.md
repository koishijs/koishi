---
sidebarDepth: 2
---

# 处理申请 (Verifier)

@koishijs/plugin-verifier 可用于配置机器人接收到各类申请时的行为。

```ts title=koishi.ts
export default {
  plugins: {
    verifier: {
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
