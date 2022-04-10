---
sidebarDepth: 2
---

# 更多功能

到目前为止，我们已经了解了指令的定义方式和触发机制，以及如何编写帮助和组织多级指令。但这只是一个开始，让我们真正将指令系统与数据库进行交互，并服务于不同的平台和用户群体时，还有更多能做的事情。

## 权限管理

::: tip
要启用权限管理，你需要安装数据库支持。
:::

除了之前介绍过的两个参数外，`ctx.command()` 还可以传入一个额外参数，它提供了指令相关的配置项。

### authority

你可以通过 `authority` 属性设置一个指令的调用权限：

```ts
// 设置 echo 命令的调用权限为 2 级
ctx.command('echo <message:text> 输出收到的信息', { authority: 2 })
  // 设置 -t 选项的调用权限为 3 级
  .option('timeout', '-t <seconds> 设定延迟发送的时间', { authority: 3 })
```

这样一来，1 级或以下权限的用户就无法调用 echo 指令；2 级权限用户只能调用 echo 指令但不能使用 -t 参数；3 级或以上权限的用户不受限制。对于受限的用户，机器人将会回复“权限不足”。

## 速率限制

::: tip
要启用速率限制，你需要安装数据库支持和官方插件 [@koishijs/plugin-rate-limit](../../plugins/accessibility/rate-limit.md)。
:::

### maxUsage

有些指令（例如签到抽卡点赞，高性能损耗的计算，限制次数的 API 调用等）我们并不希望被无限制调用，这时我们可以设置每天访问次数的上限：

```ts
// 设置 lottery 指令每人每天只能调用 10 次
ctx.command('lottery 抽卡', { maxUsage: 10 })
  // 设置使用了 -s 的调用不计入总次数
  .option('--show', '-s 查看已经抽到的物品列表', { notUsage: true })
```

这样一来，所有访问 lottery 指令且不含 -s 选项的调用次数上限便被设成了 10 次。当超出总次数后，机器人将回复“调用次数已达上限”。

### minInterval

有些指令（例如高强度刷屏）我们并不希望被短时间内重复调用，这时我们可以设置最短触发间隔：

```ts
import { Time } from 'koishi'

// 设置 lottery 指令每 60 秒只能调用 1 次
ctx.command('lottery', { minInterval: Time.minute })
```

这样一来，lottery 指令被调用后 60 秒内，如果再次被调用，将会提示“调用过于频繁，请稍后再试”。当然，`notUsage` 对 `minInterval` 也同样生效。

### usageName <Badge text="beta" type="warning"/>

如果我们希望让多个指令共同同一个调用限制，可以通过 `usageName` 来实现：

```ts
ctx.command('lottery 常驻抽卡', { maxUsage: 10 })
ctx.command('accurate 精准抽卡', { maxUsage: 10, usageName: 'lottery' })
```

这样一来，就能限制每天的 lottery 和 accurate 指令的调用次数之和不超过 10 了。

## 修改已有指令

::: tip
要修改已有指令，你需要安装官方插件 [@koishijs/plugin-commands](../../plugins/accessibility/commands.md)。
:::

## 多语言支持

## 平台集成

## 模糊匹配

在日常的使用中，我们也难免会遇到打错的情况，这时 Koishi 还会自动根据相近的指令名进行纠错提醒：

<panel-view :messages="[
  ['Alice', 'ecko hello'],
  ['Koishi', '没有此命令。你要找的是不是“echo”？发送空行或句号以调用推测的指令。'],
  ['Alice', '.'],
  ['Koishi', 'hello'],
]"/>

如果想调整模糊匹配的程度，你还可以修改配置项 [minSimilarity](../../api/core/app.md#options-minsimilarity)。是不是很方便呢？
