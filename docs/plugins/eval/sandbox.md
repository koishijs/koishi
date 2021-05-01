---
sidebarDepth: 2
---

# 沙箱 API

evaluate 指令会创建一个沙箱环境。这个沙箱环境支持 ES2020 的全部特性，外加 [Buffer](https://nodejs.org/dist/latest-v14.x/docs/api/buffer.html)。除此以外，还支持下面的属性和方法：

## 会话上下文

会话上下文中的属性和方法都是仅对当前会话生效的，类似于函数闭包。你可以尝试修改它们的值，但这将不造成任何影响。下次调用时你仍然可以访问这些值。

### user

- 类型: `Partial<User>`

调用者的用户数据。

### channel

- 类型: `Partial<Channel>`

当前频道的数据。

### storage

- 类型: `object`

可持续存储的数据。你能够使用的数据应该是[可克隆的结构化数据](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm)，它可以包括：

- 你能在 JSON 中写的数据类型（如 string, number, Array 等）
- 可以克隆的标准类的实例（如 Set, Date, RegExp 等）
- 到其他此类数据的循环引用

它不应该包括：

- 函数和类
- 你定义的类的实例
- 全局对象

如果你非要尝试这样做，你会收到一个报错。

### send(...param)

- **param:** `any[]` 要发送的内容
- 返回值: `Promise<void>`

向当前会话发送一条消息。

### exec(message)

- **message:** `string` 指令文本
- 返回值: `Promise<void>`

在当前会话执行一条指令。

## 全局对象

全局对象是通过 Worker API 暴露出来的，它并不会随着会话而重新生成。部分全局对象的值可能被禁止修改。

### utils

部分 koishi-utils 的功能将作为一个独立模块暴露在全局对象上，它包含了下列属性：

- segment
- Random
- Time

## 内置模块

### koishi/utils

### koishi/addons

## 多语言支持

下面是支持的文件后缀名。部分后缀名虽然有内置的支持，但需要你提前安装部分依赖。

- **js/json:** 原生支持
- **yml/yaml:** 原生支持
- **coffee:** 需要安装 coffeescript
- **ts:** 需要安装下面两组中的一组
  - typescript + json5
  - esbuild
