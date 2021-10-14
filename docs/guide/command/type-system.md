---
sidebarDepth: 2
---

# 类型系统

Koishi v3 加入了参数的类型系统。它的作用是规约参数和选项的类型，并在指令执行前就对不合法的调用发出警告。定义一个带类型的参数或选项很简单：

```js
function showValue(value) {
  return `${typeof value} ${JSON.stringify(value)}`
}

app.command('my-command [arg:number]')
  .option('foo', '<val:string>')
  .action(({ options }, arg) => `${showValue(arg)} ${showValue(options.foo)}`)
```

<panel-view :messages="[
  ['Alice', 'my-command 100 --foo 200'],
  ['Koishi', 'number 100 string \x22200\x22'],
  ['Alice', 'my-command xyz'],
  ['Koishi', '参数 arg 输入无效，请提供一个数字。'],
]"/>

如你所见，上文所介绍的文本参数也正是一个内置类型。

### 内置类型

目前 Koishi 支持的内置类型有如下：

- string: `string` 字符串
- number: `number` 数值
- boolean: `boolean` 布尔值（实际上不带参数）
- text: `string` 贪婪匹配的字符串
- user: `string` 用户，格式为 `{platform}:{id}`
- channel: `string` 频道，格式为 `{platform}:{id}`
- integer: `number` 整数
- posint: `number` 正整数
- date: `Date` 日期

### 定义新类型

使用 `Argv.createDomain()` 创建新类型：

::: code-group language
```js
const { Argv } = require('koishi')

Argv.createDomain('repeat', source => source.repeat(3))

app.command('test [arg:repeat]')
  .action((_, arg) => arg)
```
```ts
import { Argv } from 'koishi'

declare module 'koishi' {
  namespace Argv {
    interface Domain {
      repeat: string
    }
  }
}

Argv.createDomain('repeat', source => source.repeat(3))

app.command('test [arg:repeat]')
  .action((_, arg) => arg)
```
:::

<panel-view :messages="[
  ['Alice', 'test foo'],
  ['Koishi', 'foofoofoo'],
]"/>

### 类型检查

你也可以在 `Argv.createDomain()` 的回调函数中抛出错误，以实现类型检查的目的：

::: code-group language
```js
const { Argv } = require('koishi')

Argv.createDomain('positive', (source) => {
  const value = +source
  if (Math.sign(value) !== 1) throw new Error('应为正数。')
  return value
})

app.command('test [x:positive]')
  .action((_, arg) => arg)
```
```ts
import { Argv } from 'koishi'

declare module 'koishi' {
  namespace Argv {
    interface Domain {
      positive: number
    }
  }
}

Argv.createDomain('positive', (source) => {
  const value = +source
  if (Math.sign(value) !== 1) throw new Error('应为正数。')
  return value
})

app.command('test [x:positive]')
  .action((_, arg) => arg)
```
:::

<panel-view :messages="[
  ['Alice', 'test 0.5'],
  ['Koishi', '参数 x 输入无效，应为整数。'],
]"/>

### 选项的临时类型

你可以在 `cmd.option()` 的第三个参数中传入一个 `type` 属性，作为选项的临时类型声明。它可以是像上面的例子一样的回调函数，也可以是一个 `RegExp` 对象，表示传入的选项应当匹配的正则表达式：

```js
app.command('test')
  .option('foo', '-f <foo>', { type: /^ba+r$/ })
  .action(({ options }) => options.foo)
```

<panel-view :messages="[
  ['Alice', 'test -f baaaz'],
  ['Koishi', '选项 foo 输入无效，请检查语法。'],
]"/>

### 使用检查器

从 v3 开始 Koishi 支持给一个指令配置多个回调函数，并引入了 `cmd.check()`。你可以利用这个接口定义一些更加复杂的类型检查逻辑。让我们在最后简单地了解一下这个特性。

```js
app.command('test')
  .check(checker1)
  .check(checker2)
  .action(action1)
  .action(action2)
```

在上面的代码中，我们给 test 指令配置了 4 个回调函数。在运行时，这 4 个函数将逐一被调用。当其中一个函数返回值的类型为 `string` 时，这个调用过程停止，并输出这个返回值（如果返回空串，调用依然会停止，此时没有输出）。

在执行顺序上，同时，`.check()` 回调函数是先注册的先调用；而 `.action()` 则是最后注册的先调用。你还可以通过在注册回调函数时传入 truthy 作为第二个参数来实现这个效果的反转。

指令执行时将按照下面的顺序注意调用：

- before-command 事件（包括 check 回调函数）
- action 回调函数
- command 事件

因此，检查器可以在 `usage` 这样的属性尚未发生更新时进行操作，并提前退出执行流程。
