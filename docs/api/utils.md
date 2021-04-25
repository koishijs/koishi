---
sidebarDepth: 2
---

# 常用工具 (Utils)

::: tip 注意
本页显示的版本号都表示对应的 koishi-utils 版本号（而不是对应的 koishi 版本号）。
:::

包含了被 Koishi 使用的工具函数，它们由 `koishi-utils` 包提供。

## 观察者对象

### observe(target, update?, label?)

- **target:** `T extends object` 要观测的对象
- **update:** `(diff: Partial<T>) => R` 更新回调函数
- **label:** `string` 对象的标签，用于标识
- 返回值: `Observed<T>`

创建一个观察者对象。目前只支持从普通对象创建（不支持 Array / Set / Map）。

### observed._diff

观察者当前的对象变化。

### observed._merge(source)

- **source:** `object` 要合并的对象
- 返回值: `this`

将某些属性合并入当前观察者，不会触发 diff 更新。

### observed._update()

- 返回值: `R`

更新观察者对象，同时清除 diff。

## 字符串操作

### simplify(source)

- **source:** `string` 源文本
- 返回值: `string` 简体文本

繁体转简体。

### traditionalize(source)

- **source:** `string` 源文本
- 返回值: `string` 繁体文本

简体转繁体。

### capitalize(source)

- **source:** `string` 源文本
- 返回值: `string` 首字母大写后的文本

首字母大写。

### camelCase(source)

- **source:** `any` 要转换的内容
- 返回值: `any` 转换结果

如果输入的是字符串，则将字符串转换成 camelCase；如果是数组或对象，则递归地将对象中的每个（可枚举）的键转换成 camelCase；其他情况不受影响。

### paramCase(source)

如果输入的是字符串，则将字符串转换成 param-case；如果是数组或对象，则递归地将对象中的每个（可枚举）的键转换成 param-case；其他情况不受影响。

- **source:** `any` 要转换的内容
- 返回值: `any` 转换结果

### snakeCase(source)

- **source:** `any` 要转换的内容
- 返回值: `any` 转换结果

如果输入的是字符串，则将字符串转换成 snake_case；如果是数组或对象，则递归地将对象中的每个（可枚举）的键转换成 snake_case；其他情况不受影响。

## 模板操作

### template(path, ...params)

- **path:** `string` 模板路径
- **params:** `any[]` 参数列表
- 返回值: `string` 生成的字符串

根据模板路径返回插值后的字符串。如果路径不存在将会返回路径本身。

### template.set(path, value)

- **path:** `string` 模板路径
- **value:** `string | object` 模板字符串
- 返回值: `void`

定义模板字符串。如果 `value` 是一个对象，则会将 `path` 作为前缀添加到每个路径中。

### template.get(path)

- **path:** `string` 模板路径
- 返回值: `string` 模板字符串

根据模板路径返回模板字符串。如果路径不存在将会返回路径本身。

### template.format(source, ...params)

- **source:** `string` 模板字符串
- **params:** `any[]` 参数列表
- 返回值: `string` 生成的字符串

使用模板语法插值。

## 集合操作

### contain(array1, array2)

- **array1:** `readonly any[]` 数组 1
- **array2:** `readonly any[]` 数组 2
- 返回值: `boolean` 数组 1 是否包含数组 2 的全部元素

检测集合的包含关系。

### intersection(array1, array2)

- **array1:** `readonly any[]` 数组 1
- **array2:** `readonly any[]` 数组 2
- 返回值: `any[]` 两个数组的交集

求两个集合的交集。

### difference(array1, array2)

- **array1:** `readonly any[]` 数组 1
- **array2:** `readonly any[]` 数组 2
- 返回值: `any[]` 两个数组的差集

求两个集合的差集。

### union(array1, array2)

- **array1:** `readonly any[]` 数组 1
- **array2:** `readonly any[]` 数组 2
- 返回值: `any[]` 两个数组的并集

求两个集合的并集。

## 日期操作

### 静态属性

- Time.millisecond
- Time.second
- Time.minute
- Time.hour
- Time.day
- Time.week

### Time.getDateNumber(date?)

- **date:** `Date` 日期对象，默认为 `new Date()`
- 返回值: `number` UNIX 时间开始后的天数

获取当前日期（从 UNIX 时间开始时计算）。

### Time.fromDateNumber(value)

- **value:** `number` UNIX 时间开始后的天数
- 返回值: `Date` 日期对象

从 UNIX 时间开始后的天数计算日期对象。

### Time.parseTime(source)

- **source:** `string` 要解析的字符串

将一个字符串解析成时间长度。

### Time.parseDate(source)

- **source:** `string` 要解析的字符串

将一个字符串解析成 Date 对象。

### Time.formatTime(ms)

- **ms:** `number` 毫秒数

### Time.formatTimeShort(ms)

- **ms:** `number` 毫秒数

### Time.formatTimeInterval(time, interval?)

- **time:** `Date` 起始时间
- **interval:** `number` 时间间隔，单位为毫秒
- 返回值: `string`

## 输出日志

### new Logger(name)

### logger.level

### logger.extend()

### logger.error()

### logger.success()

### logger.warn()

### logger.info()

### logger.debug()

## 随机数操作

### Random.uuid()

- 返回值: `string` 生成的 UUID

生成一个标准的 UUID (v5)。

### Random.bool(probability)

- **probability:** `number` 概率
- 返回值: `boolean` 随机布尔值

生成一个随机布尔值，有 probability 的概率为 1。

### Random.real(start?, end)

- **start:** `number` 下界，默认为 0
- **end:** `end` 上界
- 返回值: `number` 一个 [start, end) 之间的随机实数

生成一个随机实数。

### Random.int(start?, end)

- **start:** `number` 下界，默认为 0
- **end:** `end` 上界
- 返回值: `number` 一个 [start, end) 之间的随机整数

生成一个随机实数。

### Random.shuffle(array)

- **array:** `T[]` 数组
- 返回值: `T[]` 新的数组

随机打乱数组中的元素，返回新的数组。

### Random.pick(array)

- **array:** `readonly T[]` 数组
- 返回值: `T` 挑出的元素

从数组中随机挑出一个元素，不改变原数组。

### Random.multiPick(array, count)

- **array:** `readonly T[]` 数组
- **count:** `number` 元素个数
- 返回值: `T[]` 挑出的元素列表

从数组中随机挑出一些元素，不改变原数组。

### Random.weightedPick(weights, value?)

- **weights:** `Record<T, number>` 权重表
- **value:** `number` 一个 0 到 1 之间的随机数，默认为 `Math.random()`
- 返回值: `T` 挑出的元素

按照权重随机挑出一个元素。

## 其他工具函数

### noop()

- 返回值: `void`

不进行任何操作（no operation）。

### sleep(ms?)

- **ms:** `number` 要等待的毫秒数
- 返回值: `Promise<void>`

等待一段时间。

### isInteger(value)

- **value:** `any` 要判断的值
- 返回值: `boolean` 是否为整数

判断传入的值是否为整数。
