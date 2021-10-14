---
sidebarDepth: 2
---

# 使用会话

### 延时发送

如果你需要连续发送多条消息，那么在各条消息之间留下一定的时间间隔是很重要的：一方面它可以防止消息刷屏和消息错位（后发的条消息呈现在先发的消息前面），提高了阅读体验；另一方面它能够有效降低机器人发送消息的频率，防止被平台误封。这个时候，`session.sendQueued()` 可以解决你的问题。

```js
// 发送两条消息，中间间隔一段时间，这个时间由系统计算决定
await session.sendQueued('message1')
await session.sendQueued('message2')

// 清空等待队列
await session.cancelQueued()
```

你也可以在发送时手动定义等待的时长：

```js
// 如果消息队列非空，在前一条消息发送完成后 1s 发送本消息
await session.sendQueued('message3', Time.second)

// 清空等待队列，并设定下一条消息发送距离现在至少 0.5s
await session.cancelQueued(0.5 * Time.second)
```

事实上，对于不同的消息长度，系统等待的时间也是不一样的，你可以通过配置项修改这个行为：

::: code-group config koishi.config
```yaml
delay:
  # 消息里每有一个字符就等待 0.02s
  character: 20
  # 每条消息至少等待 0.5s
  message: 500
```
```js
const { Time } = require('koishi')

module.exports = {
  delay: {
    // 消息里每有一个字符就等待 0.02s
    character: 0.02 * Time.second,
    // 每条消息至少等待 0.5s
    message: 0.5 * Time.second,
  },
}
```
```ts
import { Time } from 'koishi'

export default {
  delay: {
    // 消息里每有一个字符就等待 0.02s
    character: 0.02 * Time.second,
    // 每条消息至少等待 0.5s
    message: 0.5 * Time.second,
  },
}
```
:::

这样一来，一段长度为 60 个字符的消息发送后，下一条消息发送前就需要等待 1.2 秒了。

### 等待用户输入

当你需要进行一些交互式操作时，可以使用 `session.prompt()`：

```js
await session.send('请输入用户名：')

const name = await session.prompt()
if (!name) return session.send('输入超时。')

// 执行后续操作
await ctx.database.setUser(session.platform, session.userId, { name })
return session.send(`${name}，请多指教！`)
```

你可以给这个方法传入一个 `timeout` 参数，或使用 `delay.prompt` 配置项，来作为等待的时间。
