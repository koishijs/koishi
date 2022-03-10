---
sidebarDepth: 2
---

# 速率控制 (Rate Limit)

::: tip
要使用本插件，你需要安装数据库支持。
:::

## 指令配置项

@koishijs/plugin-rate-limit 会在当前应用激活以下的指令配置项：

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

## 扩展功能

### 指令：user.usage
### 指令：user.timer

- 基本语法：`user.xxx [key] [value]`
- 选项：
  - `-s, --set` 设置访问记录（需要 4 级权限）
  - `-c, --clear` 清除访问记录（需要 4 级权限）
  - `-t, --target [@user]` 目标用户（需要 3 级权限）

这两个指令用于查看和修改用户的访问记录，参见 [指令调用管理](../../guide/manage.md#指令调用管理)。

如果不提供 `-s` 和 `-c` 选项，则会显示当前的访问记录。如果使用了 `-s`，就会设置名为 `key` 的访问记录为 `value`。如果使用了 `-c` 且提供了 `key`，就会清除名为 `key` 的访问记录；否则会清除所有的访问记录。
