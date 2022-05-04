---
sidebarDepth: 2
---

# 指令系统初探

一个成功的机器人离不开强大的**指令系统**。正因为如此，Koishi 在编写时也广泛研究了许多指令系统的实现，并做成了如今的规模。使用 Koishi，你可以方便地创建和管理各种指令，并能够高效地处理大量指令的并发调用。同时，Koishi 还提供了快捷方式、多级指令、自定义前缀等功能，同时支持调用次数和频率限制，权限管理等高级特性，让你得以高自由度来配置你的机器人。

编写下面的代码，你就实现了一个简单的 echo 指令：

```ts
ctx.command('echo <message>')
  .action((_, message) => message)
```

<panel-view :messages="[
  ['Alice', 'echo Hello!'],
  ['Koishi', 'Hello!'],
]"/>

让我们回头看看这段代码是如何工作的：

- `.command()` 方法定义了一个 echo 指令，其有一个必选参数为 message
- `.action()` 方法定义了指令触发时的回调函数，第一个参数是一个 Argv 对象，第二个参数是输入的 message

这种链式的结构能够让我们非常方便地定义和扩展指令。稍后我们将看到这两个函数的更多用法，以及更多指令相关的函数。

## 定义参数

正如你在上面所见的那样，使用 `ctx.command(desc)` 方法可以定义一个指令，其中 `desc` 是一个字符串，包含了**指令名**和**参数列表**。

- 指令名可以包含数字、字母、下划线、短横线甚至中文字符，但不应该包含空格、小数点 `.` 或斜杠 `/`。小数点和斜杠的用途参见 [指令的多级结构](./help.md#指令的多级结构) 章节。
- 一个指令可以含有任意个参数。其中 **必选参数** 用尖括号包裹，**可选参数** 用方括号包裹。

例如，下面的程序定义了一个拥有三个参数的指令，第一个为必选参数，后面两个为可选参数，它们将分别作为 `action` 回调函数的第 2, 3, 4 个参数：

```ts
ctx.command('my-command <arg1> [arg2] [arg3]')
  .action((_, arg1, arg2, arg3) => { /* do something */ })
```

::: tip
除去表达的意义不同，以及参数个数不足时使用必选参数可能产生错误信息外，这两种参数在程序上是没有区别的。与此同时，默认情况下 `action` 回调函数从第二个参数起也总是字符串。如果传入的参数不足，则对应的参数不会被传入，因此你需要自己处理可能的 `undefined`。
:::

### 变长参数

有时我们需要传入未知数量的参数，这时我们可以使用 **变长参数**，它可以通过在括号中前置 `...` 来实现。在下面的例子中，无论传入了多少个参数，都会被放入 `rest` 数组进行处理：

```ts
ctx.command('my-command <arg1> [...rest]')
  .action((_, arg1, ...rest) => { /* do something */ })
```

### 文本参数

通常来说传入的信息被解析成指令调用后，会被空格分割成若干个参数。但如果你想输入的就是含有空格的内容，可以通过在括号中后置 `:text` 来声明一个 **文本参数**。
在下面的例子中，即使 my-command 后面的内容中含有空格，也会被整体传入 `message` 中：

```ts
ctx.command('my-command <message:text>')
  .action((_, message) => { /* do something */ })
```

::: tip
文本参数的解析优先级很高，即使是之后的内容中含有选项也会被一并认为是该参数的一部分。因此，当使用文本参数时，应确保选项写在该参数之前，或 [使用引号](#使用引号) 将要输入的文本包裹起来。
:::

## 定义选项

使用 `cmd.option(name, desc)` 函数可以给指令定义参数。这个函数也是可以链式调用的，就像这样：

```ts
ctx.command('my-command')
  .option('alpha', '-a')          // 定义一个选项
  .option('beta', '-b [beta]')    // 定义一个带参数的可选选项
  .option('gamma', '-c <gamma>')  // 定义一个带参数的必选选项
  .action(({ options }) => JSON.stringify(options))
```

<panel-view :messages="[
  ['Alice', 'my-command -adb text --gamma=1 --foo-bar baz --no-xyz'],
  ['Koishi', '{ \x22alpha\x22: true, \x22d\x22: true, \x22beta\x22: \x22text\x22, \x22gamma\x22: 1, \x22fooBar\x22: \x22baz\x22, \x22xyz\x22: false }'],
]"/>

从上面的例子中我们不难看出 Koishi 指令系统的许多方便的特性：

- 使用注册的多个别名中的任何一个都会被赋值到 `name` 中
- 选项和参数之间同时支持用空格或等号隔开的语法
- 单个短横线后跟多个字母时，会把之后的参数赋给最后一个字母（如果需要参数的话）
- 多字母中如果有短横线，会被自动进行驼峰式处理
- 类型自动转换：无参数默认为 `true`，如果是数字会转化为数字，其余情况为字符串
- 支持识别未注册选项，同时会根据传入的命令行推测是否需要参数
- 如果一个未注册选项以 `no-` 开头，则会自动去除这个前缀并处理为 `false`

在调用 `cmd.option()` 时，你还可以传入第三个参数，它应该是一个对象，用于配置选项的具体特性。它们将在下面逐一介绍。

### 选项的默认值

使用 `fallback` 配置选项的默认值。配置了默认值的选项，如果没有被使用，则会按照注册的默认值进行赋值。

```ts
ctx.command('my-command')
  .option('alpha', '-a', { fallback: 100 })
  .option('beta', '-b', { fallback: 100 })
  .action(({ options }) => JSON.stringify(options))
```

<panel-view :messages="[
  ['Alice', 'my-command -b 80'],
  ['Koishi', '{ \x22alpha\x22: 100, \x22beta\x22: 80 }'],
]"/>

### 选项的重载

将同一个选项注册多次，并结合使用 `value` 配置选项的重载值。如果使用了带有重载值的选项，将按照注册的重载值进行赋值。

```ts
ctx.command('my-command')
  .option('writer', '-w <id>')
  .option('writer', '--anonymous', { value: 0 })
  .action(({ options }) => JSON.stringify(options))
```

<panel-view :messages="[
  ['Alice', 'my-command --anonymous'],
  ['Koishi', '{ \x22writer\x22: 0 }'],
]"/>


## 类型系统

Koishi v3 加入了参数的类型系统。它的作用是规约参数和选项的类型，并在指令执行前就对不合法的调用发出警告。定义一个带类型的参数或选项很简单：

```ts
function showValue(value) {
  return `${typeof value} ${JSON.stringify(value)}`
}

ctx.command('my-command [arg:number]')
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

ctx.command('test [arg:repeat]').action((_, arg) => arg)
```

<panel-view :messages="[
  ['Alice', 'test foo'],
  ['Koishi', 'foofoofoo'],
]"/>

### 类型检查

你也可以在 `Argv.createDomain()` 的回调函数中抛出错误，以实现类型检查的目的：

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
  return value.toString()
})

ctx.command('test [x:positive]').action((_, arg) => arg)
```

<panel-view :messages="[
  ['Alice', 'test 0.5'],
  ['Koishi', '参数 x 输入无效，应为整数。'],
]"/>

### 选项的临时类型

你可以在 `cmd.option()` 的第三个参数中传入一个 `type` 属性，作为选项的临时类型声明。它可以是像上面的例子一样的回调函数，也可以是一个 `RegExp` 对象，表示传入的选项应当匹配的正则表达式：

```ts
ctx.command('test')
  .option('foo', '-f <foo>', { type: /^ba+r$/ })
  .action(({ options }) => options.foo)
```

<panel-view :messages="[
  ['Alice', 'test -f baaaz'],
  ['Koishi', '选项 foo 输入无效，请检查语法。'],
]"/>

<!-- ### 使用检查器

从 v3 开始 Koishi 支持给一个指令配置多个回调函数，并引入了 `cmd.before()`。你可以利用这个接口定义一些更加复杂的类型检查逻辑。让我们在最后简单地了解一下这个特性。

```ts
ctx.command('test')
  .before(checker1)
  .before(checker2)
  .action(action1)
  .action(action2)
```

在上面的代码中，我们给 test 指令配置了 4 个回调函数。在运行时，这 4 个函数将逐一被调用。当其中一个函数返回值的类型为 `string` 时，这个调用过程停止，并输出这个返回值（如果返回空串，调用依然会停止，此时没有输出）。

在执行顺序上，同时，`.before()` 回调函数是先注册的先调用；而 `.action()` 则是最后注册的先调用。你还可以通过在注册回调函数时传入 truthy 作为第二个参数来实现这个效果的反转。

指令执行时将按照下面的顺序注意调用：

- before-command 事件（包括 check 回调函数）
- action 回调函数
- command 事件

因此，检查器可以在 `usage` 这样的属性尚未发生更新时进行操作，并提前退出执行流程。 -->
