---
sidebarDepth: 2
---

# 编写翻译文件

`i18n.define()` 允许开发者为自己的插件提供多套翻译，但直接将每种语言的翻译文本写进源代码并不利于代码的解耦。因此我们建议开发者将翻译文件写在一个单独的目录中，同时 `i18n.define()` 只需要引用这个目录中的文件即可：

```
plugin-root
├── src
│   ├── locales
│   │   ├── en.yml
│   │   └── zh.yml
│   └── index.ts
└── package.json
```

```ts index.ts
ctx.i18n.define('en', require('./locales/en'))
ctx.i18n.define('zh', require('./locales/zh'))
```

::: tip
在上面的例子中我们使用了 yaml 作为翻译文件的格式。这是因为它的语法简洁美观，非常适合本地化开发。你也可以采用 json 等任何你喜欢的格式进行开发。
:::

::: warning
Node.js 并不支持直接加载 yaml / yml 后缀的文件，但我们可以通过适当的 [register](https://nodejs.org/api/cli.html#-r---require-module) 解决这个问题。对此我们的官方脚手架已经内置了相应的支持。
:::

## 指令本地化

在 [编写帮助](../command/help.md#编写帮助) 一节中，我们已经了解到指令和参数的描述文本都是在指令注册时就定义的。这种做法对单语言开发固然方便，但并不适合多语言开发，因为它将翻译逻辑与代码逻辑耦合了。如果你希望你编写的指令支持多语言，那么需要将翻译文本单独定义：

```yaml
commands:
  foo:
    description: 指令描述
    usage: |
      指令用法
      可以是多行文本
    examples: |
      foo qux
      foo --bar qux
    options:
      bar: 选项描述
```

```ts index.ts
ctx.command('foo').option('bar')
```

### 作用域渲染

## 工作区开发

## 覆盖默认文本
