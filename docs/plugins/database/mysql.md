---
title: 数据库：MySQL
sidebarDepth: 2
---

# @koishijs/plugin-database-mysql

::: danger 注意
这里是**正在施工**的 koishi v3 的文档。要查看 v1 版本的文档，请前往[**这里**](/v1/)。
:::

::: tip 注意
本页显示的版本号都表示对应的 @koishijs/plugin-database-mysql 版本号（而不是对应的 koishi 版本号）。

所有功能实现均对应于 MySQL v5.7。
:::

## db.mysql.joinKeys(keys?)

- **keys:** `string[]` 要连接的字段
- 返回值: `string` 连接后的结果

连接字段成字符串。

## db.mysql.query(sql, values?)

- **sql:** `string` SQL 字符串
- **value:** `any` 要插入的值
- 返回值: `Promise<any>` 请求结果

发送 SQL 请求。

## db.mysql.select(table, fields?, conditional?, values?)

- **table:** `string` 表名
- **fields:** `string[]` 字段列表
- **conditional:** `string` SQL 条件语句
- **values:** `any` 要插入的值
- 返回值: `Promise<any>`

搜索表中的数据。

## db.mysql.update(table, id, data)

- **table:** `string` 表名
- **id:** `number` 行号
- **data:** `any` 要更新的数据
- 返回值: `Promise<any>`

更新表中的某行。

## db.mysql.count(table)

- **table:** `string` 表名
- 返回值: `Promise<number>` 表中的行数

计算表中的行数。
