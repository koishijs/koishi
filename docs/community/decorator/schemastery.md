---
sidebarDepth: 2
noTwoslash: true
---

# 描述配置模式

借助 [schemastery-gen](https://code.mycard.moe/3rdeye/schemastery-gen) 这个包，我们可以使用装饰器进行编写 Koishi 插件所需要的描述配置模式。插件加载时，类将会自动实例化，并注入这些方法。

我们需要使用 `@RegisterSchema` 装饰器对配置类进行修饰，使其成为一个 Schema 对象。同时，需要对每个出现于配置的成员属性使用 `@SchemaProperty` 进行修饰。

对于每一个成员字段，系统将会尝试推断这些字段类型，也可以使用 `type` 参数手动指定类型或另一个 Schema 对象。

特别地，系统可以推断出某一字段是否为数组，但是无法推断数组内部的类型。因此下例中我们**必须**手动指定 `someArray` 的内部类型为 `string`。

```ts
import { RegisterSchema, SchemaProperty } from 'schemastery-gen'
import { Context } from 'koishi'

@RegisterSchema() // Config 类本身会成为 Schema 对象
export class Config {
  constructor(_config: any) {}

  @SchemaProperty({ default: 'baz' })
  foo: string // 自动推断出 Schema.string()

  getFoo() {
    return this.foo
  }

  @SchemaProperty({ type: Schema.number(), required: true }) // 也可手动指定 Schema 对象
  bar: number

  @SchemaProperty({ type: String })
  someArray: string[] // 自动推断出 Schema.array(...)，但是无法推断内部类型，需要手动指定
}

export const name = 'myplugin'
export function apply(ctx: Context, config: Partial<Config>) {

}
```

## 嵌套配置

在配置类存在嵌套的情况下，内层类也会自动实例化，并且会自动注入到外层类的对应属性中。

```ts
@RegisterSchema()
export class ChildConfig {
  constructor(_config: any) {}

  @SchemaProperty({ default: 'baz' })
  foo: string

  @SchemaProperty({ type: Schema.number(), required: true })
  bar: number
}

// Config 类本身会成为 Schema 对象
@SchemaProperty()
export class Config {
  constructor(_config: any) {}

  // 自动推断出 ChildConfig
  @SchemaProperty()
  child: ChildConfig

  // 无法自动推断 ChildConfig，需要手动指定。但是可以推断出外层的 Schema.array(...)
  @SchemaProperty({ type: ChildConfig })
  children: ChildConfig[]
}
```

## 循环嵌套配置

如果配置类存在循环嵌套，我们需要使用 `SchemaRef(() => Type)` 方法进行定义。

```ts
@RegisterSchema()
export class Author {
  constructor(_: Partial<Author>) {}

  @SchemaProperty()
  name: string

  getName() {
    return this.name
  }

  @SchemaProperty({
    type: SchemaRef(() => Post), // 循环嵌套类的数组，array 可以由成员变量类型自动推断。
  })
  posts: Post[]
}

@RegisterSchema()
export class Post {
  constructor(_: Partial<Post>) {}

  @SchemaProperty()
  name: string

  getName() {
    return this.name
  }

  @SchemaProperty({
    type: SchemaRef(() => Author), // 循环嵌套
  })
  author: Author

  @SchemaProperty({
    type: SchemaRef(() => Post), // 指定自身为类型也需要如此使用。
  })
  childPosts: Post[]
}
```

## 描述合并

使用 `Mixin()` 方法，我们可以轻松对配置类进行合并。

```ts
class DressColor {
  @SchemaProperty({ default: 'red' })
  color: string
}

class DressSize {
  @SchemaProperty({ default: 'M' })
  size: string
}

@RegisterSchema()
class Dress extends Mixin(DressColor, DressSize) {
  @SchemaProperty({ default: 'dress' })
  name: string
}
```
