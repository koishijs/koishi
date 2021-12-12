---
sidebarDepth: 2
---

# 上下文选择器

一个 **上下文** 描述了机器人的一种可能的运行环境。例如，如果一个指令或中间件被绑定在了上面例子中的上下文，那么只有该环境下的事件才会触发对应的回调函数。之前介绍过的 `ctx.on()`, `ctx.middleware()` 以及 `ctx.plugin()` 这些 API 都是上下文类所提供的方法，而我们能在 `app` 上调用这些方法只是因为 `App` 对象本身也是一个上下文而已。

### 使用选择器

我们可以通过 **选择器** 来快速创建新的上下文：

```js
app.group() // 选择全部群聊会话
app.group.except() // 选择全部私聊会话

app.group('112233') // 选择来自群 112233 的会话
app.group.except('112233') // 选择来自除了群 112233 以外的群的会话

app.user('445566') // 选择来自用户 445566 的会话（包括群聊和私聊）
app.group.except().user('445566') // 选择来自用户 445566 的私聊会话
```

它们实际上是 `ctx.select()` 和 `ctx.unselect()` 方法的语法糖。对于上面的最后一个例子，你可以等价地表示成：

```js
// 选择来自用户 445566 的私聊会话
app.unselect('groupId').select('userId', '445566')
```

利用上下文，你可以非常方便地对每个环境进行分别配置：

```js
// 在所有环境注册中间件
app.middleware(callback)

// 当有人申请加群 112233 时触发 listener
app.group('112233').on('group-request', listener)

// 注册指令 my-command，有数据库支持时才生效
app.select('database').command('my-command')

// 安装插件 ./my-plugin，仅限 OneBot 平台使用
app.select('platform', 'onebot').plugin(require('./my-plugin'))
```

是不是非常方便呢？

### 使用过滤器

你也可以自定义一个上下文的 **过滤器** 函数：它传入一个会话对象，并返回一个 boolean 类型。

```js
// 满足当前上下文条件，且消息内容为“啦啦啦”
ctx.intersect(session => session.content === '啦啦啦')

// 满足当前上下文条件，或消息内容为“啦啦啦”
ctx.union(session => session.content === '啦啦啦')
```

这里的两个方法 `ctx.intersect()` 和 `ctx.union()` 也可以传入一个上下文，表示两个上下文的交集和并集：

```js
// 选择来自用户 445566 的私聊会话
app.unselect('groupId').intersect(app.select('userId', '445566'))

// 选择来自用户 445566 的会话，以及全部私聊会话
app.unselect('groupId').union(app.select('userId', '445566'))
```

这些方法会返回一个新的上下文，在其上使用监听器、中间件、指令或是插件就好像同时在多个上下文中使用一样。

### 在配置文件中使用选择器

如果你使用配置文件，我们也提供了使用选择器的方法：

```js koishi.config.js
export default {
  plugins: {
    common: {
      // 选择器配置
      // 仅在 onebot 平台下 2 个特定频道内注册插件
      $platform: 'onebot',
      $channel: ['123456', '456789'],

      // 其他配置
      onRepeat: {
        minTimes: 3,
        probability: 0.5,
      },
    },
  },
}
```

这相当于

```js
app
  .platform('onebot')
  .channel('123456', '456789')
  .plugin(require('@koishijs/plugin-common'), {
    onRepeat: {
      minTimes: 3,
      probability: 0.5,
    },
  })
```

当你要使用集合运算的时候，也有对应的语法：

```yaml koishi.config.yml
# 我们也支持 yaml 格式的配置文件
plugins:
  eval:
    # 禁止 discord 平台触发，除非特定调用者在私聊访问
    $union:
      - $private: '123456789'
      - $except:
          $platform: 'discord'
```

这相当于

```js
app
  .private('123456789')
  .union(app.except(app.platform('discord')))
  .plugin(require('@koishijs/plugin-eval'), {})
```
