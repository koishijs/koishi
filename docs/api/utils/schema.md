---
sidebarDepth: 2
---

# 配置模式 (Schema)

## 静态方法

### Schema.any()

声明一个任意类型的值。

```ts
// @errors: 2769

const validate = Schema.any()

validate()                // undefined
validate(0)               // 0
validate({})              // {}
```

### Schema.never()

声明一个空值 (`null` 或 `undefined`)。

```ts
// @errors: 2769

const validate = Schema.never()

validate()                // undefined
validate(0)               // TypeError
validate({})              // TypeError
```

### Schema.const(value)

声明一个常量值。

```ts
// @errors: 2769

const validate = Schema.const(10)

validate(10)              // 10
validate(0)               // TypeError
```

### Schema.number()

声明一个数值类型的值。

```ts
// @errors: 2769

const validate = Schema.number()

validate()                // undefined
validate(1)               // 1
validate('')              // TypeError
```

### Schema.string()

声明一个字符串类型的值。

```ts
// @errors: 2769

const validate = Schema.string()

validate()                // undefined
validate(0)               // TypeError
validate('foo')           // 'foo'
```

### Schema.boolean()

声明一个布尔类型的值。

```ts
// @errors: 2769

const validate = Schema.boolean()

validate()                // undefined
validate(0)               // TypeError
validate(true)            // true
```

### Schema.is(constructor)

声明一个给定类的实例。

```ts
// @errors: 2769

const validate = Schema.is(RegExp)

validate()                // undefined
validate(/foo/)           // /foo/
validate('foo')           // TypeError
```

### Schema.array(inner)

声明一个数组，其所有元素都匹配 `inner` 的类型。

```ts
// @errors: 2769

const validate = Schema.array(Schema.number())

validate()                      // []
validate(0)                     // TypeError
validate([0, 1])                // [0, 1]
validate([0, '1'])              // TypeError
```

### Schema.dict(inner)

声明一个对象 (键值对)，其所有值都匹配 `inner` 的类型。

```ts
// @errors: 2769

const validate = Schema.dict(Schema.number())

validate()                      // {}
validate(0)                     // TypeError
validate({ a: 0, b: 1 })        // { a: 0, b: 1 }
validate({ a: 0, b: '1' })      // TypeError
```

### Schema.tuple(list)

声明一个数组，其每个元素依次匹配 `list` 中对应元素的类型。

```ts
// @errors: 2769

const validate = Schema.tuple([
  Schema.number(),
  Schema.string(),
])

validate()                      // []
validate([0])                   // { a: 0 }
validate([0, 1])                // TypeError
validate([0, '1'])              // [0, '1']
```

### Schema.object(dict)

声明一个对象，其每个属性都匹配 `dict` 中对应属性的类型。

```ts
// @errors: 2769

const validate = Schema.object({
  a: Schema.number(),
  b: Schema.string(),
})

validate()                      // {}
validate({ a: 0 })              // { a: 0 }
validate({ a: 0, b: 1 })        // TypeError
validate({ a: 0, b: '1' })      // { a: 0, b: '1' }
```

### Schema.union(list)

声明一个值，其类型可匹配 `list` 中任意一个类型。

```ts
// @errors: 2769

const validate = Schema.union([
  Schema.number(),
  Schema.string(),
])

validate()                      // undefined
validate(0)                     // 0
validate('1')                   // '1'
validate(true)                  // TypeError
```

### Schema.intersect(list)

声明一个值，其类型可匹配 `list` 中所有类型。

```ts
// @errors: 2769

const validate = Schema.intersect([
  Schema.object({ a: Schema.string().required() }),
  Schema.object({ b: Schema.number().default(0) }),
])

validate()                      // TypeError
validate({ a: '' })             // { a: '', b: 0 }
validate({ a: '', b: 1 })       // { a: '', b: 1 }
validate({ a: '', b: '2' })     // TypeError
```

### Schema.transform(inner, callback)

声明一个可匹配 `inner` 的值，并调用 `callback`，将返回值作为输出结果。

```ts
// @errors: 2769

const validate = Schema.transform(Schema.number().default(0), n => n + 1)

validate()                      // 1
validate('0')                   // TypeError
validate(10)                    // 11
```

## 实例方法

### schema.required()

声明一个类型不可为空值 (`null` 或 `undefined`)。

### schema.default(value)

声明一个类型的默认值。

### schema.description(text)

为类型提供描述文本。

## 简写形式

对于上述静态方法，其参数可以使用下列的简写形式：

- `undefined` -> `Schema.any()`
- `String` -> `Schema.string()`
- `Number` -> `Schema.number()`
- `Boolean` -> `Schema.boolean()`
- `1` -> `Schema.const(1)` (仅对基础类型有效)
- `Date` -> `Schema.is(Date)`

```ts
// @errors: 2769

Schema.array(String)            // Schema.array(Schema.string())
Schema.dict(RegExp)             // Schema.dict(Schema.is(RegExp))
Schema.union([1, 2])            // Schema.union([Schema.const(1), Schema.const(2)])
```

你还可以使用 `Schema.from()` 方法来从简写形式获得推断后的类型：

```ts
// @errors: 2769

Schema.from()                   // Schema.any()
Schema.from(Date)               // Schema.is(Date)
Schema.from('foo')              // Schema.const('foo')
```

## 代码示例

下面是一些例子，展示了如何使用 Schema 构造一些常见的高级类型。

### 枚举类型

```ts
// @errors: 2769

const Enum = Schema.union(['red', 'blue'])

Enum('red')                     // 'red'
Enum('blue')                    // 'blue'
Enum('green')                   // TypeError
```

### 转换为字符串

```ts
// @errors: 2769

const ToString = Schema.transform(Schema.any(), v => String(v))

ToString('')                    // ''
ToString(0)                     // '0'
ToString({})                    // '{}'
```

### 单个值或者列表

```ts
// @errors: 2769

const Listable = Schema.union([
  Schema.array(Number),
  Schema.transform(Number, n => [n]),
]).default([])

Listable()                      // []
Listable(0)                     // [0]
Listable([1, 2])                // [1, 2]
```

### 对象键值别名

```ts
// @errors: 2769

const Config = Schema.dict(Number, Schema.union([
  'foo',
  Schema.transform('bar', () => 'foo'),
]))

Config({ foo: 1 })              // { foo: 1 }
Config({ bar: 2 })              // { foo: 2 }
Config({ bar: '3' })            // TypeError
```
