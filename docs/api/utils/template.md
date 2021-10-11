---
sidebarDepth: 2
---

# 模板 (Template)

## template(path, ...params)

- **path:** `string` 模板路径
- **params:** `any[]` 参数列表
- 返回值: `string` 生成的字符串

根据模板路径返回插值后的字符串。如果路径不存在将会返回路径本身。

## template.set(path, value)

- **path:** `string` 模板路径
- **value:** `string | object` 模板字符串
- 返回值: `void`

定义模板字符串。如果 `value` 是一个对象，则会将 `path` 作为前缀添加到每个路径中。

## template.get(path)

- **path:** `string` 模板路径
- 返回值: `string` 模板字符串

根据模板路径返回模板字符串。如果路径不存在将会返回路径本身。

## template.format(source, ...params)

- **source:** `string` 模板字符串
- **params:** `any[]` 参数列表
- 返回值: `string` 生成的字符串

使用模板语法插值。

