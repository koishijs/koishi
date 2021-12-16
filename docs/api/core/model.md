---
sidebarDepth: 2
---

# 数据模型 (Model)

## 数据类型

数据类型会被用于 [`model.extend()`](#model-extend-name-fields-config) 方法中，其定义如下：

```ts
export interface Field<T> {
  type: string
  length?: number
  nullable?: boolean
  initial?: T
  comment?: string
}
```

### 数值类型

| 名称 | TS 类型 | 默认长度 | 默认初始值 | 说明 |
| :-: | :-: | :-: | :-: | :-: |
| integer | `number` | 10 | `0` | 有符号整型数，长度决定了数据的范围 |
| unsigned | `number` | 10 | `0` | 无符号整型数，长度决定了数据的范围 |
| float | `number` | 固定长度 | `0` | 单精度浮点数 |
| double | `number` | 固定长度 | `0` | 双精度浮点数 |

### 字符串类型

| 名称 | TS 类型 | 默认长度 | 默认初始值 | 说明 |
| :-: | :-: | :-: | :-: | :-: |
| char | `string` | 64 | `''` | 定长的字符串 |
| string | `string` | 256 | `''` | 变长的字符串 |
| text | `string` | 65535 | `''` | 变长的字符串 |

### 时间类型

| 名称 | TS 类型 | 默认长度 | 默认初始值 | 说明 |
| :-: | :-: | :-: | :-: | :-: |
| date | `Date` | 固定长度 | `null` | 日期值 |
| time | `Date` | 固定长度 | `null` | 时间值 |
| timestamp | `Date` |  固定长度 | `null` | 时间戳 |

### 其他类型

| 名称 | TS 类型 | 默认长度 | 默认初始值 | 说明 |
| :-: | :-: | :-: | :-: | :-: |
| json | `object` | 65535 | `null` | 可被序列化为 json 的结构化数据 |
| list | `string[]` | 65535 | `[]` | 字符串构成的列表，序列化时以逗号分隔 |

## 实例方法

### model.extend(name, fields, config?) <Badge type="warning" text="beta"/>

- **name:** `string` 数据表名
- **fields:** `Field.Config` 字段信息
- **config:** `Table.Meta` 表的基本配置
  - **config.primary:** `string | string[]` 主键名，默认为 `'id'`
  - **config.unique:** `(string | string[])[]` 值唯一的键名列表
  - **config.foreign:** `Dict<[string, string]>` 值唯一的键名列表
  - **config.autoInc:** `boolean` 是否使用自增主键

扩展一个新的数据表。

### model.create(name)

### model.resolveQuery(query)

### model.resolveModifier(modifier)
