---
sidebarDepth: 2
---

# 上下文选择器

一个 **上下文 (Context)** 描述了机器人的一种可能的运行环境。例如，如果一个指令或中间件被绑定在了上面例子中的上下文，那么只有该环境下的事件才会触发对应的回调函数。之前介绍过的 `ctx.on()`, `ctx.middleware()` 以及 `ctx.plugin()` 这些 API 都是上下文类所提供的方法，而我们能在 `app` 上调用这些方法只是因为 `App` 对象本身也是一个上下文而已。

## 会话选择器

我们可以通过 **会话选择器 (Session Selector)** 来快速创建新的上下文：

```ts
app.user('112233')                  // 选择来自用户 112233 的会话
app.self('112233')                  // 选择发送给机器人 112233 的会话
app.guild('445566')                 // 选择来自群组 445566 的会话
app.channel('778899')               // 选择来自频道 778899 的会话
app.platform('discord')             // 选择来自平台 discord 的会话
```

这种写法也支持链式的调用：

```ts
// 选择来自平台 discord 中用户 112233 的会话
app.platform('discord').user('112233')
```

利用上下文，你可以非常方便地对每个环境进行分别配置：

```ts
// 在所有环境注册中间件
app.middleware(callback)

// 注册指令 my-command，仅对机器人 112233 有效
app.self('112233').command('my-command')

// 当有人申请加群 445566 时触发 listener
app.guild('445566').on('guild-request', listener)

// 安装插件 ./my-plugin，仅限 OneBot 平台使用
app.platform('onebot').plugin(require('./my-plugin'))
```

是不是非常方便呢？

## 条件选择器

如果感觉简单的会话选择器无法满足你的需求，你也可以给一个上下文添加 **条件选择器 (Condition Selector)**：它传入一个会话对象，并返回一个布尔类型。过滤器有三种添加方式：

```ts
// 满足当前上下文条件，且消息内容为“啦啦啦”
ctx.intersect(session => session.content === '啦啦啦')

// 满足当前上下文条件，或消息内容为“啦啦啦”
ctx.union(session => session.content === '啦啦啦')

// 满足当前上下文条件，且消息内容不为“啦啦啦”
ctx.exclude(session => session.content === '啦啦啦')
```

上述方法也可以传入一个上下文作为参数，分别表示两个上下文的交集、并集和差集：

```ts
// 选择来自群组 1122233 和用户 445566 的会话
app.guild('112233').intersect(app.user('445566'))

// 选择来自群组 1122233 或用户 445566 的会话
app.guild('112233').union(app.user('445566'))

// 选择来自群组 1122233 的会话，但来自用户 445566 的会话除外
app.guild('112233').exclude(app.user('445566'))
```

与选择器方法类似，过滤器方法也会返回一个新的上下文，你可以在其上自由的添加监听器、中间件、指令和插件。

## 配置插件上下文

加载插件的时候，我们也可以通过第二个参数选择插件的上下文：

```ts
ctx.plugin('repeater', {
  // 仅在 onebot 平台下 2 个特定频道内注册插件
  $platform: 'onebot',
  $channel: ['123456', '456789'],

  // 插件的配置
  onRepeat: {
    minTimes: 3,
    probability: 0.5,
  },
})
```

这相当于

```ts
ctx
  .platform('onebot')
  .channel('123456', '456789')
  .plugin('repeater', {
    onRepeat: {
      minTimes: 3,
      probability: 0.5,
    },
  })
```

这种写法也同样支持过滤器，并且它最大的好处是可以被写进配置文件中：

::: code-group config koishi
```yaml
plugins:
  eval:
    # 禁止 discord 平台触发，除非是特定调用者访问
    $or:
      - $user: '123456789'
      - $not:
          $platform: 'discord'

    # 插件的配置
    scriptLoader: 'esbuild'
```
```ts
export default {
  plugins: {
    eval: {
      // 禁止 discord 平台触发，除非是特定调用者访问
      $or: [
        { $user: '123456789' },
        { $not: { $platform: 'discord' } },
      ],

      // 插件的配置
      scriptLoader: 'esbuild',
    },
  },
}
```
:::

这相当于

```ts
app
  .user('123456789')
  .union(app.exclude(app.platform('discord')))
  .plugin('eval', {
    scriptLoader: 'esbuild',
  })
```

::: tip
注意到这些属性是与插件的配置项写在一起的。因为这些特殊属性的存在，我们始终建议将插件的配置项设置为一个普通对象 (而不是原始类型或数组等其他类的实例)。
:::
