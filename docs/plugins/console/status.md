---
sidebarDepth: 2
---

# 运行状态 (Status)

## 指令：status

- 快捷调用：你的状态，查看状态，运行情况，运行状态

status 指令可以用于查看机器人的运行状态。

<panel-view title="聊天记录">
<chat-message nickname="Alice" color="#cc0066">你的状态</chat-message>
<chat-message nickname="Koishi" avatar="/koishi.png">
<p>5 名四季酱正在为 20 个群和 2409 名用户提供服务。</p>
<p>四季酱 2 号：工作中（2/min）</p>
<p>四季酱 3 号：工作中（3/min）</p>
<p>四季酱 4 号：工作中（3/min）</p>
<p>四季酱 5 号：工作中（0/min）</p>
<p>四季酱 9 号：工作中（5/min）</p>
<p>==========</p>
<p>更新时间：2019-12-8 14:41:15</p>
<p>启动时间：2019-12-8 14:52:12</p>
<p>已运行 43 天 10 小时 22 分钟</p>
<p>已载入指令：105</p>
<p>已载入中间件：8</p>
<p>CPU 使用率：1% / 2%</p>
<p>内存使用率：34% / 91%</p>
</chat-message>
</panel-view>

### 修改指令输出

可以使用模板语法修改 status 指令的输出。默认的代码实现如下：

<div v-pre>

```ts
template.set('status', {
  bot: '{{ username }}：{{ code ? `无法连接` : `工作中（${currentRate[0]}/min）` }}',
  output: [
    '{{ bots }}',
    '==========',
    '活跃用户数量：{{ activeUsers }}',
    '活跃群数量：{{ activeGuilds }}',
    'CPU 使用率：{{ (cpu[0] * 100).toFixed() }}% / {{ (cpu[1] * 100).toFixed() }}%',
    '内存使用率：{{ (memory[0] * 100).toFixed() }}% / {{ (memory[1] * 100).toFixed() }}%',
  ].join('\n'),
})
```
</div>

## 配置项

### tickInterval

- 类型: `number`
- 默认值: `Time.second * 5`

页面同步 profile 数据的时间。
