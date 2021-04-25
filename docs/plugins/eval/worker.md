---
sidebarDepth: 2
---

# 子线程 API

子线程 API 可通过 [`setupFiles`](./config.md#setupfiles) 配置项访问：

```js koishi.config.js
export default {
  plugins: {
    eval: {
      setupFiles: {
        worker: '/path/to/worker.js',
      },
    },
  },
}
```

```js worker.js
import { internal } from 'koishi-plugin-eval/lib/worker'

internal.setGlobal('foo', 1)
```

::: warning
本章中介绍的 API 都只能在子线程中访问，请不要尝试在主线程中这么写！
:::

## main

- 类型: [`MainHandle`](./main.md#mainhandle)

主线程 MainHandle 对象的代理。Koishi 的内部机制将允许你如同直接在主线程里调用 MainHandle 方法那样调用这里的 `main` 对象。当然你只能通过 `main` 做到这件事。

## config

- 类型: `object`

从主线程传递到子线程的配置项。

## response

- 类型: `object`

子线程初始化的结果。将被传回到主线程并作为 [eval/start](./main.md#eval-start) 事件的参数。你可以修改这个对象以达到在初始化阶段传递信息给主线程的目的。

## WorkerHandle

子线程暴露给主线程的方法。如果你要在运行时阶段从主线程调用子线程，那么请扩展这个类的原型链。

### handle.sync(scope)

- **scope:** `WorkerSession` [会话上下文](./sandbox.md#会话上下文)
- 返回值: `Promise<void>`

同步会话上下文（包括应用 user, channel 属性的变更，保存 storage 到本地等）。

### handle.eval(data, options)

- **data:** `SessionData` 会话上下文数据
- **options:** `EvalOptions` 执行脚本的选项
  - **options.silent:** `boolean` 是否不产生输出
  - **options.source:** `string` 要执行的脚本
- 返回值: `Promise<string>` 执行结果

在沙箱中执行一段脚本。

### handle.callAddon(data, argv)

- **data:** `SessionData` 会话上下文数据
- **argv:** `AddonArgv` Argv 对象
  - **argv.name:** `string` 指令名
  - **argv.args:** `any[]` 参数列表
  - **argv.options:** `{}` 选项列表
- 返回值: `Promise<string>` 调用结果

在沙箱中调用一个扩展指令。

## createSession(data)

创建一个[会话上下文](./sandbox.md#会话上下文)。

- **data:** `SessionData` 会话上下文数据
- 返回值: `WorkerSession` 会话上下文

## formatError(error)

- **error:** `Error` 异常信息
- 返回值: `string`

格式化异常信息。这个方法会处理 `error.stack` 的内容以保护你的真实文件路径不被暴露。

## synthetize(identifier, namespace, globalName?)

- **identifier:** `string` 模块名称
- **namespace:** `object` 模块的导出
- **globalName:** `string` 全局属性名称

创建一个虚拟模块。如果传入了 `globalName`，还会将这个模块暴露为全局属性。

## Internal

::: warning
请在充分理解的基础上小心使用 Internal API。不恰当的使用方式将存在导致沙箱逃逸的风险。
:::

koishi-plugin-eval 中的代码在一个沙箱环境中运行，而这个沙箱在一个子线程中运行。沙箱和子线程中的对象必须严格隔离，不然攻击者可利用沙箱逃逸获取到子线程中的全局对象，进而操作你的电脑。Internal API 提供的方法可以让你得以在子线程中操作沙箱的内部对象。

### internal.contextify(value)

- **value:** `object` 沙箱外的对象

将一个沙箱外的对象打包成沙箱内的对象。

### internal.decontextify(value)

- **value:** `object` 沙箱内的对象

将一个沙箱内的对象解包为沙箱外的对象。

### internal.setGlobal(name, value, writable?)

- **name:** `string | number | symbol` 属性名称
- **value:** `object` 沙箱外的对象（这个方法会调用 contextify 进行打包）
- **writable:** `boolean` 是否可覆写（这里的可覆写性包括此属性值是否被覆盖和此属性的深层子属性值是否可以在沙箱内部被修改）

设置沙箱内全局属性 name 的值为 value。

### internal.getGlobal(name)

- **name:** `string | number | symbol` 属性名称
- 返回值: `any`

获取沙箱内全局属性 name 的值。

### internal.connect(outer, inner)

- **outer:** `object` 要绑定对象
- **inner:** `object` 要绑定对象

将对象 inner 与 outer 相绑定。每当要打包 outer 为沙箱内的对象时返回 inner；反之每当要将 inner 解包为沙箱外的对象时返回 outer。

## mapDirectory(identifier, filename)

将 filename 下的文件路径映射到 identifier。这个映射关系会在 [`formatError()`](#formaterror) 等方法中用到。

- **identifier:** `string` 虚拟路径名称
- **filename:** `string` 实际文件路径

## 示例代码

下面是一段示例代码，展示了如何使用 `synthetize()` 和 `mapDirectory()` 创建一个 utils 全局对象：

```js worker.js
import { synthetize, mapDirectory } from 'koishi-plugin-eval/lib/worker'
import { Random } from 'koishi-utils'

// 创建一个只导出一个 Random 对象的 koishi/utils.ts 模块，并暴露为全局属性 utils
synthetize('koishi/utils.ts', { Random }, 'utils')

// 将 koishi-utils 的路径映射到虚拟路径 koishi/utils/ 下
mapDirectory('koishi/utils/', require.resolve('koishi-utils'))
```
